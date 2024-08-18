// This file contains definitions for all phases in the game.
import {Stack} from "./stacks.mjs";
import {createStackCreatedEvent} from "./events.mjs";
import {Step} from "./steps.mjs";
import {StepRunner, arrayStepGenerator} from "./stepGenerators.mjs";
import {ScriptValue} from "./cdfScriptInterpreter/structs.mjs";
import * as actions from "./actions.mjs";
import * as requests from "./inputRequests.mjs";
import * as abilities from "./abilities.mjs";

// Base class for all phases
class Phase {
	constructor(turn, types) {
		this.turn = turn;
		this.types = types;
		// Set by a step when it successfully runs, to be read by the TriggerRoot AST nodes right after.
		this.lastActionList = [];
	}

	async* run() {}

	getSteps() {
		return [];
	}
	getActions() {
		return [];
	}

	matches(phaseIndicator, player) {
		let yourPhase = false;
		let opponentPhase = false;
		if (phaseIndicator.startsWith("opponent")) {
			opponentPhase = true;
			phaseIndicator = phaseIndicator.substring(8);
		} else if (phaseIndicator.startsWith("you")) {
			yourPhase = true;
			phaseIndicator = phaseIndicator.substring(3);
		}
		phaseIndicator = phaseIndicator[0].toLowerCase() + phaseIndicator.substring(1);
		if ((yourPhase && player != this.turn.player) ||
			(opponentPhase && player == this.turn.player) ||
			!this.types.includes(phaseIndicator)) {
			return false;
		}
		return true;
	}
}

// Base class for any phase that works with stacks and blocks
export class StackPhase extends Phase {
	constructor(turn, types) {
		super(turn, types);
		this.stacks = [];
		this.ranStartSteps = false;
	}

	async* run() {
		// we need to check this because the end phase repeats itself (it calls run() in a loop)
		if (!this.ranStartSteps) {
			const startStepRunner = new StepRunner(
				() => arrayStepGenerator(this.turn.actionLists[this.types[0]]),
				this.turn.game
			);
			await (yield* startStepRunner.run());
			// TODO: Were we actually supposed to run steps that got queued during this?
			this.ranStartSteps = true;
		}

		let currentStackIndex = 0;
		do {
			currentStackIndex = 0;
			do {
				currentStackIndex++;
				this.stacks.push(new Stack(this, currentStackIndex));
				yield [createStackCreatedEvent(this.currentStack())];
				yield* this.currentStack().run();
			} while (this.currentStack().blocks.length > 0);

			// reset on what stacks trigger abilities were met since we're going back to stack 1.
			for (let player of this.turn.game.players) {
				for (let card of player.getActiveCards()) {
					for (let ability of card.values.current.abilities) {
						if ((ability instanceof abilities.TriggerAbility ||
							ability instanceof abilities.CastAbility) &&
							ability.after
						) {
							ability.triggerMetOnStacks = [];
						}
					}
				}
			}
		} while (currentStackIndex > 1);
	}

	async getBlockOptions(stack) {
		return [
			new requests.Pass(stack.getNextPlayer()),
			new requests.CastSpell(stack.getNextPlayer(), ...(await this.getCastableSpells(stack))),
			new requests.ActivateTriggerAbility(stack.getNextPlayer(), await this.getActivatableTriggerAbilities(stack)),
			new requests.ActivateFastAbility(stack.getNextPlayer(), await this.getActivatableFastAbilities(stack))
		];
	}

	async getCastableSpells(stack) {
		const player = stack.getNextPlayer();
		const castable = [];
		const costOptionTrees = [];
		for (const card of player.handZone.cards) {
			const costOptionTree = await card.getCastabilityCostOptionTree(true, player);
			if (await costOptionTree?.isValid()) { // no tree = not a spell = invalid
				castable.push(card);
				costOptionTrees.push(costOptionTree);
			}
		}
		return [castable, costOptionTrees];
	}

	async getActivatableFastAbilities(stack) {
		const eligibleAbilities = [];
		const player = stack.getNextPlayer();
		for (const card of player.getActiveCards()) {
			for (const ability of card.values.current.abilities) {
				if (ability instanceof abilities.FastAbility && await ability.canActivate(ability.card, player)) {
					eligibleAbilities.push(ability);
				}
			}
		}
		return eligibleAbilities;
	}

	async getActivatableTriggerAbilities(stack) {
		const eligibleAbilities = [];
		const player = stack.getNextPlayer();
		for (const card of player.getActiveCards()) {
			for (const ability of card.values.current.abilities) {
				if (ability instanceof abilities.TriggerAbility && await ability.canActivate(ability.card, player)) {
					eligibleAbilities.push(ability);
				}
			}
		}
		return eligibleAbilities;
	}

	getBlocks() {
		return this.stacks.map(stack => stack.blocks).flat();
	}
	getSteps() {
		return this.stacks.map(stack => stack.getSteps()).flat();
	}
	getActions() {
		return this.stacks.map(stack => stack.getActions()).flat();
	}

	currentStack() {
		return this.stacks.at(-1) ?? null;
	}
}

export class ManaSupplyPhase extends Phase {
	constructor(turn) {
		super(turn, ["manaSupplyPhase"]);
		this.steps = [];
	}

	async* run() {
		// RULES: First, if any player has more than 5 mana, their mana will be reduced to five.
		const firstReduceManaActions = [];
		for (const player of this.turn.game.players) {
			if (player.mana > 5) {
				firstReduceManaActions.push(new actions.LoseMana(player, player.mana - 5));
			}
		}
		if (firstReduceManaActions.length > 0) {
			this.steps.push(new Step(this.turn.game, firstReduceManaActions));
			await (yield* this.runStep());
		}

		// RULES: Next, the active player gains 5 mana.
		if (!this.turn.game.config.useOldManaRule || this.turn.index % this.turn.game.players.length === 0) {
			// manaPlyers is the list of players that need to gain mana this turn.
			// usually this is only the turn player, but when using the old mana rule, both players gain mana on the first player's turn
			const manaPlayers = this.turn.game.config.useOldManaRule? this.turn.game.players : [this.turn.player];
			this.steps.push(new Step(this.turn.game, manaPlayers.map(player => new actions.GainMana(player, player.values.current.manaGainAmount))));
			await (yield* this.runStep());

			// RULES: Then they pay their partner's level in mana. If they can't pay, they loose the game.
			const payForPartnerActions = [];
			for (const player of manaPlayers) {
				if (!player.values.current.needsToPayForPartner) continue;
				const partnerLevel = player.partnerZone.cards[0].values.current.level;
				if (partnerLevel == 0) continue;
				if (player.mana < partnerLevel) {
					player.next().victoryConditions.push("partnerCostTooHigh");
				} else {
					payForPartnerActions.push(new actions.LoseMana(player, partnerLevel));
				}
			}
			// player(s) might've just lost
			yield* this.turn.game.checkGameOver();
			// if we made it through that, it's time to actually pay mana
			if (payForPartnerActions.length > 0) {
				this.steps.push(new Step(this.turn.game, payForPartnerActions));
				await (yield* this.runStep());
			}

			// RULES: If they still have more than 5 mana, it will again be reduced to 5.
			const secondReduceManaActions = [];
			for (const player of manaPlayers) {
				if (player.mana > 5) {
					secondReduceManaActions.push(new actions.LoseMana(player, player.mana - 5));
				}
			}
			if (secondReduceManaActions.length > 0) {
				this.steps.push(new Step(this.turn.game, secondReduceManaActions));
				await (yield* this.runStep());
			}
		}

		// RULES: At the end of the mana supply phase, any player with more than 8 hand cards discards down to 8.
		// (turn player chooses first)
		for (let player of [this.turn.player, this.turn.player.next()]) {
			if (player.handZone.cards.length > 8) {
				const choiceRequest = new requests.ChooseCards(player, player.handZone.cards, [player.handZone.cards.length - 8], "handTooFull");
				const chosenCards = await choiceRequest.extractResponseValue((yield [choiceRequest]));
				this.steps.push(new Step(this.turn.game, chosenCards.map(card => new actions.Discard(
					player,
					card,
					new ScriptValue("dueToReason", ["turnDiscard"])
				))));
				await (yield* this.runStep());
			}
		}
	}

	async* runStep() {
		await (yield* this.steps.at(-1).run());
		while(this.steps.at(-1).followupStep) {
			this.steps.push(this.steps.at(-1).followupStep);
		}
	}

	getSteps() {
		return this.steps;
	}
	getActions() {
		return this.steps.map(step => step.actions).flat();
	}
}

export class DrawPhase extends StackPhase {
	constructor(turn) {
		super(turn, ["drawPhase"]);
	}

	async getBlockOptions(stack) {
		let blockOptions = await super.getBlockOptions(stack);
		if (this.turn.index != 0 && !this.turn.hasStandardDrawn && stack.index == 1 && stack.blocks.length == 0) {
			blockOptions.push(new requests.DoStandardDraw(this.turn.player));
		}
		return getHighestPriorityOptions(blockOptions);
	}
}

export class MainPhase extends StackPhase {
	constructor(turn) {
		const types = ["mainPhase"];
		types.unshift(turn.phases.length > 3? "mainPhase2" : "mainPhase1");
		super(turn, types);
	}

	async getBlockOptions(stack) {
		const options = await super.getBlockOptions(stack);
		if (stack.canDoNormalActions()) {
			// turn actions
			if (!this.turn.hasStandardSummoned) {
				options.push(new requests.DoStandardSummon(this.turn.player, await this.getSummonableUnits()));
			}
			options.push(new requests.DeployItem(this.turn.player, ...(await this.getDeployableItems())));
			if (!this.turn.hasRetired) {
				const eligibleUnits = [];
				for (const card of this.turn.player.unitZone.cards.concat(this.turn.player.partnerZone.cards)) {
					if (card) {
						// RULES: Note that you cannot retire units that have been summoned this turn or the turn before.
						let recentTurnActions = this.turn.getActions();
						if (this.turn.game.turns.length > 1) {
							recentTurnActions = this.turn.game.turns.at(-2).getActions().concat(recentTurnActions);
						}
						let summons = recentTurnActions.filter(action => action instanceof actions.Summon && action.card.globalId === card.globalId);
						if (summons.length > 0) {
							continue;
						}

						eligibleUnits.push(card);
					}
				}
				options.push(new requests.DoRetire(this.turn.player, eligibleUnits));
			}

			// optional abilities
			options.push(new requests.ActivateOptionalAbility(this.turn.player, await this.getActivatableOptionalAbilities()));
		}
		return getHighestPriorityOptions(options);
	}

	async getActivatableOptionalAbilities() {
		const eligibleAbilities = [];
		for (const card of this.turn.player.getActiveCards()) {
			for (const ability of card.values.current.abilities) {
				if (ability instanceof abilities.OptionalAbility && await ability.canActivate(ability.card, this.turn.player)) {
					eligibleAbilities.push(ability);
				}
			}
		}
		return eligibleAbilities;
	}

	async getSummonableUnits() {
		let summonable = [];
		for (const card of this.turn.player.handZone.cards) {
			if (await card.canSummon(true, this.turn.player)) {
				summonable.push(card);
			}
		}
		return summonable;
	}

	async getDeployableItems() {
		const deployable = [];
		const costOptionTrees = [];
		for (const card of this.turn.player.handZone.cards) {
			const costOptionTree = await card.getDeployabilityCostOptionTree(true, this.turn.player)
			if (await costOptionTree?.isValid()) { // no tree = not an item = invalid
				deployable.push(card);
				costOptionTrees.push(costOptionTree);
			}
		}
		return [deployable, costOptionTrees];
	}
}

export class BattlePhase extends StackPhase {
	constructor(turn) {
		super(turn, ["battlePhase"]);
	}

	async getBlockOptions(stack) {
		let options = await super.getBlockOptions(stack);
		if (stack.canDoNormalActions()) {
			// check for fight
			if (this.turn.game.currentAttackDeclaration) {
				return [new requests.DoFight(this.turn.player)];
			}

			// find eligible attackers
			let eligibleAttackers = this.turn.player.partnerZone.cards.concat(this.turn.player.unitZone.cards.filter(card => card !== null));
			eligibleAttackers = eligibleAttackers.filter(card => card.canAttack());
			if (eligibleAttackers.length > 0) {
				options.push(new requests.DoAttackDeclaration(this.turn.player, eligibleAttackers));
			}
		}
		return getHighestPriorityOptions(options);
	}
}

export class EndPhase extends StackPhase {
	constructor(turn) {
		super(turn, ["endPhase"]);
		this.notInStack = false; // set when running end-of-turn steps so that currentStack() does not return anything
	}

	async* run() {
		do {
			this.notInStack = false;
			yield* super.run();
			this.notInStack = true;

			const stepRunner = new StepRunner(
				() => arrayStepGenerator(this.turn.actionLists.end),
				this.turn.game
			);
			await (yield* stepRunner.run());
			this.turn.actionLists.end = []; // needs to clear this so they don't re-run
			// TODO: Were we actually supposed to run steps that got queued during this?
		} while (await this.triggerAbilitiesMet());
	}

	async triggerAbilitiesMet() {
		for (const player of this.turn.game.players) {
			for (const card of player.getActiveCards()) {
				for (const ability of card.values.current.abilities) {
					if (ability instanceof abilities.TriggerAbility && await ability.canActivate(card, player)) {
						return true;
					}
				}
			}
		}
		return false;
	}

	async getBlockOptions(stack) {
		return getHighestPriorityOptions(await super.getBlockOptions(stack));
	}

	currentStack() {
		if (this.notInStack) return null;
		return super.currentStack();
	}
}

function getOptionPriority(option) {
	if (["doFight", "doStandardDraw"].includes(option.type)) {
		return 2;
	}
	if (option.type == "activateTriggerAbility") {
		let hasMandatory = false;
		for (let i = option.eligibleAbilities.length -1; i >= 0; i--) {
			if (option.eligibleAbilities[i].mandatory) {
				if (!hasMandatory) {
					option.eligibleAbilities.splice(i + 1);
					hasMandatory = true;
				}
			} else if (hasMandatory) {
				option.eligibleAbilities.splice(i, 1);
			}
		}
		if (hasMandatory) {
			return 1;
		}
	}
	return 0;
}

function getHighestPriorityOptions(blockOptions) {
	let priorityLevels = [];
	for (let option of blockOptions) {
		let priority = getOptionPriority(option);
		while (priorityLevels.length - 1 < priority) {
			priorityLevels.push([]);
		}
		priorityLevels[priority].push(option);
	}
	return priorityLevels.pop();
}