
import * as game from "./game.mjs";
import * as actions from "./actions.mjs";
import * as abilities from "./abilities.mjs";
import * as stepGenerators from "./stepGenerators.mjs";
import {ScriptValue, TargetObjects} from "./cdfScriptInterpreter/structs.mjs";
import {ObjectValues, FightValues} from "./objectValues.mjs";
import {Step} from "./steps.mjs";

// Base class for all blocks
class Block {
	constructor(type, stack, player, stepRunner, costStepRunner = null) {
		this.type = type;
		this.player = player;
		this.stack = stack;
		this.stepRunner = stepRunner;
		this.costStepRunner = costStepRunner;
		if (this.costStepRunner) {
			this.costStepRunner.isCost = true;
		}
		this.followupStep = null;
		this.isCancelled = false;
	}

	async* runCost() {
		if (!this.costStepRunner) {
			return true;
		}
		const costStepsSuccess = await (yield* this.costStepRunner.run());
		if (!costStepsSuccess) {
			yield* this.undoCost();
		}
		return costStepsSuccess;
	}

	// returns whether or not the block got cancelled and therefore didn't run.
	async* run() {
		if (this.getIsCancelled()) {
			return false;
		}
		await (yield* this.stepRunner.run());
		return true;
	}

	* undoCost() {
		yield* this.costStepRunner.undo();
	}

	* undoExecution() {
		yield* this.stepRunner.undo();
	}

	// might be overwritten by subclasses to implement more complex checks.
	getIsCancelled() {
		return this.isCancelled;
	}

	getCostSteps() {
		return this.costStepRunner?.steps ?? [];
	}
	getExecutionSteps() {
		return this.stepRunner.getSteps();
	}
	getCostActions() {
		if (this.costStepRunner) {
			return this.costStepRunner.getSteps().map(step => step.actions).flat();
		} else {
			return [];
		}
	}
	getExecutionActions() {
		return this.stepRunner.getSteps().map(step => step.actions).flat();
	}
}

export class StandardDraw extends Block {
	constructor(stack, player) {
		super("standardDrawBlock", stack, player, new stepGenerators.StepRunner(() =>
			stepGenerators.standardDrawStepGenerator(player),
			player.game
		));
	}

	async* runCost() {
		if (await (yield* super.runCost())) {
			this.stack.phase.turn.hasStandardDrawn = true;
			return true;
		}
		return false;
	}
}

export class StandardSummon extends Block {
	constructor(stack, player, card) {
		let placeAction = new actions.Place(player, card, player.unitZone);
		super("standardSummonBlock", stack, player,
			new stepGenerators.StepRunner(() =>
				stepGenerators.arrayStepGenerator([
					[new actions.Summon(player, placeAction, new ScriptValue("dueToReason", ["standardSummon"]))]
				]),
				player.game
			),
			new stepGenerators.StepRunner(() =>
				stepGenerators.combinedStepGenerator([
					card.getSummoningCost(player),
					stepGenerators.arrayStepGenerator([[
						placeAction
					]])
				]),
				player.game
			)
		);
		this.card = card;
	}

	async* runCost() {
		this.card = this.card.snapshot();
		let paid = await (yield* super.runCost());
		if (!paid) {
			this.card.zone.add(this.card.current(), this.card.index);
			return false;
		}
		this.stack.phase.turn.hasStandardSummoned = true;
		return true;
	}
}

export class Retire extends Block {
	constructor(stack, player, units) {
		super("retireBlock", stack, player, new stepGenerators.StepRunner(() => stepGenerators.retireStepGenerator(player, units), player.game));
		this.units = units;
		for (const unit of units) {
			unit.inRetire = this;
		}
	}

	async* runCost() {
		const paid = await (yield* super.runCost());
		if (!paid) {
			return false;
		}
		this.stack.phase.turn.hasRetired = true;
		return true;
	}
}

export class AttackDeclaration extends Block {
	constructor(stack, player, attackers) {
		let establishAction = new actions.EstablishAttackDeclaration(player, attackers);
		super("attackDeclarationBlock", stack, player, new stepGenerators.StepRunner(() =>
			stepGenerators.arrayStepGenerator([
				[establishAction]
			]),
			player.game
		));
		this.attackers = attackers;
		for (const unit of attackers) {
			unit.inAttackDeclarationBlock = this;
		}
		this.establishAction = establishAction;
	}

	async* run() {
		if (!(await (yield* super.run()))) {
			return false;
		}

		this.attackTarget = this.establishAction.attackTarget; // already a snapshot
		this.player.game.currentAttackDeclaration = new game.AttackDeclaration(this.player, this.attackers, this.attackTarget.current());
		this.attackers = this.attackers.map(attacker => attacker.snapshot());
		return true;
	}

	async* undoExecution() {
		this.attackDeclaration.undoClear();
		yield* super.undoExecution();
	}

	getIsCancelled() {
		if (this.attackers.length === 0) {
			return true;
		}
		return super.getIsCancelled();
	}
}

export class Fight extends Block {
	constructor(stack, player) {
		// holds modifiable values about the fight, only gets recognized as an active object once the block executes
		const attackDeclaration = stack.phase.turn.game.currentAttackDeclaration;
		const fight = {
			values: new ObjectValues(new FightValues(player.game.players)),
			cdfScriptType: "fight",
			// these two are used for calculating the participants property
			attackers: attackDeclaration.attackers,
			target: attackDeclaration.target
		};
		super("fightBlock", stack, player, new stepGenerators.StepRunner(() => {
			return stepGenerators.fightStepGenerator(stack.phase.turn.game.currentAttackDeclaration, fight);
		}, player.game));
		this.attackDeclaration = attackDeclaration;
		this.fight = fight;
	}

	async* run() {
		const gotCancelled = await (yield* super.run());
		this.attackDeclaration.clear();
		return gotCancelled;
	}

	async* undoExecution() {
		this.attackDeclaration.undoClear();
		yield* super.undoExecution();
	}

	getIsCancelled() {
		return super.getIsCancelled() || !this.attackDeclaration.isValid();
	}
}

export class AbilityActivation extends Block {
	constructor(stack, player, ability, costOptionTree) {
		// By the time this block executes, the snapshot might not be able to resolve to a card anymore
		// This is good because any references to "this card" should be invalid by then.
		const card = ability.card.snapshot();
		const ctx = ability.makeMainContext(card, player);
		super("abilityActivationBlock", stack, player,
			new stepGenerators.StepRunner(() =>
				stepGenerators.abilityStepGenerator(ability, ctx),
				player.game
			),
			new stepGenerators.StepRunner(() =>
				stepGenerators.abilityCostStepGenerator(ability, ctx),
				player.game
			)
		);
		costOptionTree.setRunner(this.costStepRunner);
		this.costStepRunner.optionTree = costOptionTree;
		this.card = card;
		this.ability = ability;
	}

	async* runCost() {
		this.card = this.card.snapshot();
		if (!(await (yield* super.runCost()))) {
			return false;
		}
		this.ability.successfulActivation(this.player.game.currentStack());
		return true;
	}
}

export class DeployItem extends Block {
	constructor(stack, player, card, costOptionTree) {
		const scriptTargets = new TargetObjects();
		let execStepGenerators = [
			stepGenerators.arrayStepGenerator([
				// snapshot card here to not track it when it moves to another zone during its effect
				[new actions.Deploy(player, card.snapshot(), player.spellItemZone, new ScriptValue("dueToReason", ["deployment"]))]
			])
		];

		// for equipable items
		let equipGeneratorHandled = false;

		// handle deploy ability
		let deployAbility = null;
		for (let ability of card.values.current.abilities) {
			if (ability instanceof abilities.DeployAbility) {
				deployAbility = ability;
				const ctx = ability.makeMainContext(card, player, scriptTargets);
				if (card.values.current.cardTypes.includes("equipableItem")) {
					execStepGenerators.unshift(stepGenerators.equipStepGenerator(
						player,
						stepGenerators.abilityStepGenerator(ability, ctx)
					));
					equipGeneratorHandled = true;
				} else {
					execStepGenerators.unshift(stepGenerators.abilityStepGenerator(ability, ctx));
				}
				// cards only ever have one of these
				break;
			}
		}
		if (!equipGeneratorHandled && card.values.current.cardTypes.includes("equipableItem")) {
			execStepGenerators.unshift(stepGenerators.equipStepGenerator(player));
		}
		execStepGenerators.push(stepGenerators.spellItemDiscardGenerator(player, card));

		super("deployBlock", stack, player,
			new stepGenerators.StepRunner(() => stepGenerators.combinedStepGenerator(execStepGenerators), player.game),
			new stepGenerators.StepRunner(() => card.getDeploymentCost(player, scriptTargets), player.game)
		);
		costOptionTree.setRunner(this.costStepRunner);
		this.costStepRunner.optionTree = costOptionTree;
		this.card = card;
		this.deployAbility = deployAbility;
		this.equipTarget = null; // holds the selected unit for this equipable item

		this.placeStep = new Step(player.game, [new actions.Place(player, card, player.spellItemZone)]);
	}

	async* runCost() {
		this.card = this.card.snapshot();
		if (!(await (yield* super.runCost()))) {
			return false;
		}
		yield* this.placeStep.run();
		return true;
	}

	* undoCost() {
		yield* this.placeStep.undo();
		yield* super.undoCost();
	}
}

export class CastSpell extends Block {
	constructor(stack, player, card, costOptionTree) {
		const scriptTargets = new TargetObjects();
		const execStepGenerators = [
			stepGenerators.arrayStepGenerator([
				// snapshot card here to not track it when it moves to another zone during its effect
				[new actions.Cast(player, card.snapshot(), player.spellItemZone, new ScriptValue("dueToReason", ["casting"]))]
			])
		];

		// handle cast ability
		let castAbility = null;
		let enchantGeneratorHandled = false;
		for (let ability of card.values.current.abilities) {
			if (ability instanceof abilities.CastAbility) {
				castAbility = ability;
				const ctx = ability.makeMainContext(card, player, scriptTargets);
				if (card.values.current.cardTypes.includes("equipableItem")) {
					execStepGenerators.unshift(stepGenerators.equipStepGenerator(
						player,
						stepGenerators.abilityStepGenerator(ability, ctx)
					));
					enchantGeneratorHandled = true;
				} else {
					execStepGenerators.unshift(stepGenerators.abilityStepGenerator(ability, ctx));
				}
				// cards only ever have one of these
				break;
			}
		}
		if (!enchantGeneratorHandled && card.values.current.cardTypes.includes("enchantSpell")) {
			execStepGenerators.unshift(stepGenerators.equipStepGenerator(player));
		}
		execStepGenerators.push(stepGenerators.spellItemDiscardGenerator(player, card));

		super("castBlock", stack, player,
			new stepGenerators.StepRunner(() => stepGenerators.combinedStepGenerator(execStepGenerators), player.game),
			new stepGenerators.StepRunner(() => card.getCastingCost(player, scriptTargets), player.game)
		);
		this.costStepRunner.optionTree = costOptionTree;
		costOptionTree.setRunner(this.costStepRunner);
		this.card = card;
		this.castAbility = castAbility;
		this.equipTarget = null; // holds the selected unit for this enchant spell

		this.placeStep = new Step(player.game, [new actions.Place(player, card, player.spellItemZone)]);
	}

	async* runCost() {
		this.card = this.card.snapshot();
		if (!(await (yield* super.runCost()))) {
			return false;
		}
		yield* this.placeStep.run();
		return true;
	}

	* undoCost() {
		yield* this.placeStep.undo();
		yield* super.undoCost();
	}
}