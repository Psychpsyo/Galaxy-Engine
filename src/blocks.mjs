
import * as game from "./game.mjs";
import * as actions from "./actions.mjs";
import * as abilities from "./abilities.mjs";
import * as timingGenerators from "./timingGenerators.mjs";
import {ScriptContext, ScriptValue, TargetObjects} from "./cdfScriptInterpreter/structs.mjs";
import {ObjectValues, FightValues} from "./objectValues.mjs";
import {Timing} from "./timings.mjs";

// Base class for all blocks
class Block {
	constructor(type, stack, player, timingRunner, costTimingRunner = null) {
		this.type = type;
		this.player = player;
		this.stack = stack;
		this.timingRunner = timingRunner;
		this.costTimingRunner = costTimingRunner;
		if (this.costTimingRunner) {
			this.costTimingRunner.isCost = true;
		}
		this.followupTiming = null;
		this.isCancelled = false;
	}

	async* runCost() {
		if (!this.costTimingRunner) {
			return true;
		}
		let costTimingSuccess = await (yield* this.costTimingRunner.run());
		if (!costTimingSuccess) {
			yield* this.undoCost();
		}
		return costTimingSuccess;
	}

	// returns whether or not the block got cancelled and therefore didn't run.
	async* run() {
		if (this.getIsCancelled()) {
			return false;
		}
		await (yield* this.timingRunner.run());
		return true;
	}

	* undoCost() {
		yield* this.costTimingRunner.undo();
	}

	* undoExecution() {
		yield* this.timingRunner.undo();
	}

	// might be overwritten by subclasses to implement more complex checks.
	getIsCancelled() {
		return this.isCancelled;
	}

	getCostTimings() {
		return this.costTimingRunner?.timings ?? [];
	}
	getExecutionTimings() {
		return this.timingRunner.timings;
	}
	getCostActions() {
		if (this.costTimingRunner) {
			return this.costTimingRunner.timings.map(timing => timing.actions).flat();
		} else {
			return [];
		}
	}
	getExecutionActions() {
		return this.timingRunner.timings.map(timing => timing.actions).flat();
	}
}

export class StandardDraw extends Block {
	constructor(stack, player) {
		super("standardDrawBlock", stack, player, new timingGenerators.TimingRunner(() =>
			timingGenerators.standardDrawTimingGenerator(player),
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
			new timingGenerators.TimingRunner(() =>
				timingGenerators.arrayTimingGenerator([
					[new actions.Summon(player, placeAction, new ScriptValue("dueToReason", "standardSummon"))]
				]),
				player.game
			),
			new timingGenerators.TimingRunner(() =>
				timingGenerators.combinedTimingGenerator([
					card.getSummoningCost(player),
					timingGenerators.arrayTimingGenerator([[
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
		super("retireBlock", stack, player, new timingGenerators.TimingRunner(() => timingGenerators.retireTimingGenerator(player, units), player.game));
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
		super("attackDeclarationBlock", stack, player, new timingGenerators.TimingRunner(() =>
			timingGenerators.arrayTimingGenerator([
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
		super("fightBlock", stack, player, new timingGenerators.TimingRunner(() => {
			return timingGenerators.fightTimingGenerator(stack.phase.turn.game.currentAttackDeclaration, fight);
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
	constructor(stack, player, ability) {
		// By the time this block executes, the snapshot might not be able to resolve to a card anymore
		// This is good because any references to "this card" should be invalid by then.
		const card = ability.card.snapshot();
		const scriptTargets = new TargetObjects();
		super("abilityActivationBlock", stack, player,
			new timingGenerators.TimingRunner(() =>
				timingGenerators.abilityTimingGenerator(ability, card, player, scriptTargets),
				player.game
			),
			new timingGenerators.TimingRunner(() =>
				timingGenerators.abilityCostTimingGenerator(ability, card, player, scriptTargets),
				player.game
			)
		);
		this.card = card;
		this.ability = ability;
	}

	async* runCost() {
		this.card = this.card.snapshot();
		if (!(await (yield* super.runCost()))) {
			return false;
		}

		// Needs to be checked after paying the cost in case paying the cost made some targets invalid.
		if (this.ability.exec && !this.ability.exec.hasAllTargets(new ScriptContext(this.card, this.player, this.ability))) {
			yield* this.undoCost();
			return false;
		}

		this.ability.successfulActivation();
		return true;
	}
}

export class DeployItem extends Block {
	constructor(stack, player, card, costOptionTree) {
		const scriptTargets = new TargetObjects();
		let execTimingGenerators = [
			timingGenerators.arrayTimingGenerator([
				// snapshot card here to not track it when it moves to another zone during its effect
				[new actions.Deploy(player, card.snapshot(), player.spellItemZone, new ScriptValue("dueToReason", "deployment"))]
			])
		];

		// for equipable items
		let equipGeneratorHandled = false;

		// handle deploy ability
		let deployAbility = null;
		for (let ability of card.values.current.abilities) {
			if (ability instanceof abilities.DeployAbility) {
				deployAbility = ability;
				if (card.values.current.cardTypes.includes("equipableItem")) {
					execTimingGenerators.unshift(timingGenerators.equipTimingGenerator(
						player,
						timingGenerators.abilityTimingGenerator(ability, card, player, scriptTargets)
					));
					equipGeneratorHandled = true;
				} else {
					execTimingGenerators.unshift(timingGenerators.abilityTimingGenerator(ability, card, player, scriptTargets));
				}
				// cards only ever have one of these
				break;
			}
		}
		if (!equipGeneratorHandled && card.values.current.cardTypes.includes("equipableItem")) {
			execTimingGenerators.unshift(timingGenerators.equipTimingGenerator(player));
		}
		execTimingGenerators.push(timingGenerators.spellItemDiscardGenerator(player, card));

		super("deployBlock", stack, player,
			new timingGenerators.TimingRunner(() => timingGenerators.combinedTimingGenerator(execTimingGenerators), player.game),
			new timingGenerators.TimingRunner(() => card.getDeploymentCost(player, scriptTargets), player.game)
		);
		costOptionTree.setRunner(this.costTimingRunner);
		this.costTimingRunner.optionTree = costOptionTree;
		this.card = card;
		this.deployAbility = deployAbility;
		this.equipTarget = null; // holds the selected unit for this equipable item

		this.placeTiming = new Timing(player.game, [new actions.Place(player, card, player.spellItemZone)]);
	}

	async* runCost() {
		this.card = this.card.snapshot();
		if (!(await (yield* super.runCost()))) {
			return false;
		}

		yield* this.placeTiming.run();

		// Needs to be checked after paying the cost in case paying the cost made some targets invalid.
		if (!this.card.current() ||
			(this.deployAbility && this.deployAbility.exec && !this.deployAbility.exec.hasAllTargets(new ScriptContext(this.card.current(), this.player, this.deployAbility, this.player)))
		) {
			yield* this.undoCost();
			return false;
		}

		return true;
	}

	* undoCost() {
		yield* this.placeTiming.undo();
		yield* super.undoCost();
	}
}

export class CastSpell extends Block {
	constructor(stack, player, card, costOptionTree) {
		const scriptTargets = new TargetObjects();
		const execTimingGenerators = [
			timingGenerators.arrayTimingGenerator([
				// snapshot card here to not track it when it moves to another zone during its effect
				[new actions.Cast(player, card.snapshot(), player.spellItemZone, new ScriptValue("dueToReason", "casting"))]
			])
		];

		// handle cast ability
		let castAbility = null;
		let enchantGeneratorHandled = false;
		for (let ability of card.values.current.abilities) {
			if (ability instanceof abilities.CastAbility) {
				castAbility = ability;
				if (card.values.current.cardTypes.includes("equipableItem")) {
					execTimingGenerators.unshift(timingGenerators.equipTimingGenerator(
						player,
						timingGenerators.abilityTimingGenerator(ability, card, player, scriptTargets)
					));
					enchantGeneratorHandled = true;
				} else {
					execTimingGenerators.unshift(timingGenerators.abilityTimingGenerator(ability, card, player, scriptTargets));
				}
				// cards only ever have one of these
				break;
			}
		}
		if (!enchantGeneratorHandled && card.values.current.cardTypes.includes("enchantSpell")) {
			execTimingGenerators.unshift(timingGenerators.equipTimingGenerator(player));
		}
		execTimingGenerators.push(timingGenerators.spellItemDiscardGenerator(player, card));

		super("castBlock", stack, player,
			new timingGenerators.TimingRunner(() => timingGenerators.combinedTimingGenerator(execTimingGenerators), player.game),
			new timingGenerators.TimingRunner(() => card.getCastingCost(player, scriptTargets), player.game)
		);
		this.costTimingRunner.optionTree = costOptionTree;
		costOptionTree.setRunner(this.costTimingRunner);
		this.card = card;
		this.castAbility = castAbility;
		this.equipTarget = null; // holds the selected unit for this enchant spell

		this.placeTiming = new Timing(player.game, [new actions.Place(player, card, player.spellItemZone)]);
	}

	async* runCost() {
		this.card = this.card.snapshot();
		if (!(await (yield* super.runCost()))) {
			return false;
		}

		yield* this.placeTiming.run();

		// Needs to be checked after paying the cost in case paying the cost made some targets invalid.
		if (!this.card.current() ||
			(this.castAbility && this.castAbility.exec && !this.castAbility.exec.hasAllTargets(new ScriptContext(this.card.current(), this.player, this.castAbility, this.player)))
		) {
			yield* this.undoCost();
			return false;
		}

		return true;
	}

	* undoCost() {
		yield* this.placeTiming.undo();
		yield* super.undoCost();
	}
}