// This file contains definitions for all phases in the game.
import {Stack} from "./stacks.js";
import {createStackCreatedEvent, createPlayerWonEvent} from "./events.js";
import {Timing} from "./timings.js";
import * as actions from "./actions.js";
import * as requests from "./inputRequests.js";
import * as abilities from "./abilities.js";

// Base class for all phases
class Phase {
	constructor(turn, types) {
		this.turn = turn;
		this.types = types;
		// Set by a timing when it successfully runs, to be read by the TriggerRoot AST nodes right after.
		this.lastActionList = [];
	}

	async* run() {}

	getTimings() {
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
	}

	async* run() {
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
			requests.pass.create(stack.getNextPlayer()),
			requests.castSpell.create(stack.getNextPlayer(), await this.getCastableSpells(stack)),
			requests.activateTriggerAbility.create(stack.getNextPlayer(), await this.getActivatableTriggerAbilities(stack)),
			requests.activateFastAbility.create(stack.getNextPlayer(), await this.getActivatableFastAbilities(stack))
		];
	}

	async getCastableSpells(stack) {
		let player = stack.getNextPlayer();
		let castable = [];
		for (const card of player.handZone.cards) {
			if (await card.canCast(true, player)) {
				castable.push(card);
			}
		}
		return castable;
	}

	async getActivatableFastAbilities(stack) {
		let eligibleAbilities = [];
		let player = stack.getNextPlayer();
		for (let card of player.getActiveCards()) {
			for (const ability of card.values.current.abilities) {
				if (ability instanceof abilities.FastAbility && await ability.canActivate(ability.card, player)) {
					eligibleAbilities.push(ability);
				}
			}
		}
		return eligibleAbilities;
	}

	async getActivatableTriggerAbilities(stack) {
		let eligibleAbilities = [];
		let player = stack.getNextPlayer();
		for (let card of player.getActiveCards()) {
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
	getTimings() {
		return this.stacks.map(stack => stack.getTimings()).flat();
	}
	getActions() {
		return this.stacks.map(stack => stack.getActions()).flat();
	}

	currentStack() {
		return this.stacks[this.stacks.length - 1];
	}
}

export class ManaSupplyPhase extends Phase {
	constructor(turn) {
		super(turn, ["manaSupplyPhase"]);
		this.timings = [];
	}

	async* run() {
		// RULES: First, if any player has more than 5 mana, their mana will be reduced to five.
		let reduceManaActions = [];
		for (let player of this.turn.game.players) {
			if (player.mana > 5) {
				reduceManaActions.push(new actions.ChangeMana(player, 5 - player.mana));
			}
		}
		if (reduceManaActions.length > 0) {
			this.timings.push(new Timing(this.turn.game, reduceManaActions));
			await (yield* this.runTiming());
		}

		// RULES: Next, the active player gains 5 mana.
		let turnPlayer = this.turn.player;
		this.timings.push(new Timing(this.turn.game, [new actions.ChangeMana(turnPlayer, turnPlayer.values.current.manaGainAmount)]));
		await (yield* this.runTiming());

		// RULES: Then they pay their partner's level in mana. If they can't pay, they loose the game.
		if (turnPlayer.values.current.needsToPayForPartner) {
			let partnerLevel = turnPlayer.partnerZone.cards[0].values.current.level;
			if (turnPlayer.mana < partnerLevel) {
				let winner = turnPlayer.next();
				winner.victoryConditions.push("partnerCostTooHigh");
				yield [createPlayerWonEvent(winner)];
				while (true) {
					yield [];
				}
			} else {
				this.timings.push(new Timing(this.turn.game, [new actions.ChangeMana(turnPlayer, -partnerLevel)]));
				await (yield* this.runTiming());
			}
		}

		// RULES: If they still have more than 5 mana, it will again be reduced to 5.
		if (turnPlayer.mana > 5) {
			this.timings.push(new Timing(this.turn.game, [new actions.ChangeMana(turnPlayer, 5 - turnPlayer.mana)]));
			await (yield* this.runTiming());
		}

		// RULES: At the end of the mana supply phase, any player with more than 8 hand cards discards down to 8.
		// (turn player chooses first)
		for (let player of [turnPlayer, turnPlayer.next()]) {
			if (player.handZone.cards.length > 8) {
				let choiceRequest = requests.chooseCards.create(player, player.handZone.cards, [player.handZone.cards.length - 8], "handTooFull");
				let chosenCards = requests.chooseCards.validate((yield [choiceRequest]).value, choiceRequest);
				this.timings.push(new Timing(this.turn.game, chosenCards.map(card => new actions.Discard(player, card))));
				await (yield* this.runTiming());
			}
		}
	}

	async* runTiming() {
		await (yield* this.timings[this.timings.length - 1].run());
		while(this.timings[this.timings.length - 1].followupTiming) {
			this.timings.push(this.timings[this.timings.length - 1].followupTiming);
		}
	}

	getTimings() {
		return this.timings;
	}
	getActions() {
		return this.timings.map(timing => timing.actions).flat();
	}
}

export class DrawPhase extends StackPhase {
	constructor(turn) {
		super(turn, ["drawPhase"]);
	}

	async getBlockOptions(stack) {
		let blockOptions = await super.getBlockOptions(stack);
		if (this.turn.index != 0 && !this.turn.hasStandardDrawn && stack.index == 1 && stack.blocks.length == 0) {
			blockOptions.push(requests.doStandardDraw.create(this.turn.player));
		}
		return getHighestPriorityOptions(blockOptions);
	}
}

export class MainPhase extends StackPhase {
	constructor(turn) {
		let types = ["mainPhase"];
		types.push(turn.phases.length > 3? "mainPhase2" : "mainPhase1");
		super(turn, types);
	}

	async getBlockOptions(stack) {
		const options = await super.getBlockOptions(stack);
		if (stack.canDoNormalActions()) {
			// turn actions
			if (!this.turn.hasStandardSummoned) {
				options.push(requests.doStandardSummon.create(this.turn.player, await this.getSummonableUnits()));
			}
			options.push(requests.deployItem.create(this.turn.player, await this.getDeployableItems()));
			if (!this.turn.hasRetired) {
				const eligibleUnits = [];
				for (const card of this.turn.player.unitZone.cards.concat(this.turn.player.partnerZone.cards)) {
					if (card) {
						// RULES: Note that you cannot retire units that have been summoned this turn or the turn before.
						let recentTurnActions = this.turn.getActions();
						if (this.turn.game.turns.lenght > 1) {
							recentTurnActions = this.turn.game.turns[this.turn.game.turns.length - 2].getActions().concat(recentTurnActions);
						}
						let summons = recentTurnActions.filter(action => action instanceof actions.Summon && action.card.globalId === card.globalId);
						if (summons.length > 0) {
							continue;
						}

						eligibleUnits.push(card);
					}
				}
				options.push(requests.doRetire.create(this.turn.player, eligibleUnits));
			}

			// optional abilities
			options.push(requests.activateOptionalAbility.create(this.turn.player, await this.getActivatableOptionalAbilities()));
		}
		return getHighestPriorityOptions(options);
	}

	async getActivatableOptionalAbilities() {
		let eligibleAbilities = [];
		for (let card of this.turn.player.getActiveCards()) {
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
		let deployable = [];
		for (const card of this.turn.player.handZone.cards) {
			if (await card.canDeploy(true, this.turn.player)) {
				deployable.push(card);
			}
		}
		return deployable;
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
				return [requests.doFight.create(this.turn.player)];
			}

			// find eligible attackers
			let eligibleAttackers = this.turn.player.partnerZone.cards.concat(this.turn.player.unitZone.cards.filter(card => card !== null));
			eligibleAttackers = eligibleAttackers.filter(card => card.canAttack());
			if (eligibleAttackers.length > 0) {
				options.push(requests.doAttackDeclaration.create(this.turn.player, eligibleAttackers));
			}
		}
		return getHighestPriorityOptions(options);
	}
}

export class EndPhase extends StackPhase {
	constructor(turn) {
		super(turn, ["endPhase"]);
	}

	async* run() {
		do {
			yield* super.run();

			let timings = this.turn.endOfTurnTimings;
			this.turn.endOfTurnTimings = []; // might be filled with new timings by what happens
			for (let i = 0; i < timings.length; i++) {
				await (yield* timings[i].run());
				while (timings[i].followupTiming) {
					timings.splice(i + 1, 0, timings[i].followupTiming);
					i++;
				}
			}
		} while (this.triggerAbilitiesMet());
	}

	triggerAbilitiesMet() {
		for (let player of this.turn.game.players) {
			for (let card of player.getActiveCards()) {
				for (let ability of card.values.current.abilities) {
					if (ability instanceof abilities.TriggerAbility && ability.after && ability.triggerMetOnStacks.length > 0) {
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