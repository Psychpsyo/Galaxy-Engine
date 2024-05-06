import * as interpreter from "./cdfScriptInterpreter/interpreter.mjs";
import * as blocks from "./blocks.mjs";
import * as timingGenerators from "./timingGenerators.mjs";
import {ScriptContext} from "./cdfScriptInterpreter/structs.mjs";

export class BaseAbility {
	constructor(ability, game) {
		this.id = ability.id;
		this.condition = null;
		this.cancellable = ability.cancellable;
		this.isCancelled = false;
		if (ability.condition) {
			this.condition = interpreter.buildAST("condition", ability.id, ability.condition, game);
		}
		this.card = null; // set by the card later
		this.globalId = ++game.lastGlobalAbilityId;
		game.currentAbilities.set(this.globalId, this);
		this.globalIdHistory = [];
	}

	isConditionMet(player, evaluatingPlayer = player) {
		return this.condition === null || this.condition.evalFull(new ScriptContext(this.card, player, this, evaluatingPlayer)).next().value.get(player);
	}

	canActivate(card, player, evaluatingPlayer = player) {
		return this.isConditionMet(player, evaluatingPlayer);
	}

	snapshot() {
		return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
	}
	// always returns the current version of an ability (attached to a non-snapshot card) or null if that doesn't exist.
	current() {
		return this.card.owner.game.currentAbilities.get(this.globalId) ?? null;
	}
	// These correspond to the same functions on a card.
	invalidateSnapshots(game) {
		this.globalIdHistory.push(this.globalId);
		game.currentAbilities.delete(this.globalId);
		this.globalId = ++game.lastGlobalAbilityId;
		game.currentAbilities.set(this.globalId, this);
	}
	undoInvalidateSnapshots(game) {
		game.currentAbilities.delete(this.globalId);
		this.globalId = this.globalIdHistory.pop();
		game.currentAbilities.set(this.globalId, this);
		game.lastGlobalAbilityId--;
	}

	zoneMoveReset(game) {}
}

// This is the super class of all activatable activities that can have a cost and some processing
export class Ability extends BaseAbility {
	constructor(ability, game) {
		super(ability, game);
		// cost MUST be parsed first to not miss variable declarations that might be mentioned in exec
		this.cost =  null;
		if (ability.cost) {
			this.cost = interpreter.buildAST("cost", ability.id, ability.cost, game);
		}
		this.exec = interpreter.buildAST("exec", ability.id, ability.exec, game);
		this.scriptVariables = {};
	}

	async canActivate(card, player, evaluatingPlayer = player) {
		if (!super.canActivate(card, player, evaluatingPlayer)) {
			return false;
		}
		if (this.cost === null) {
			return this.exec.hasAllTargets(new ScriptContext(card, player, this, evaluatingPlayer));
		}
		let timingRunner = new timingGenerators.TimingRunner(() => timingGenerators.abilityCostTimingGenerator(this, card, player), player.game);
		timingRunner.isCost = true;
		let costOptionTree = await timingGenerators.generateOptionTree(timingRunner, () => this.exec.hasAllTargets(new ScriptContext(card, player, this, evaluatingPlayer)));
		return costOptionTree.valid;
	}

	* runCost(card, player) {
		if (this.cost) {
			yield* this.cost.eval(new ScriptContext(card, player, this));
		}
	}

	* run(card, player) {
		yield* this.exec.eval(new ScriptContext(card, player, this));
	}

	successfulActivation() {}

	// TODO: Override snapshot() to properly snapshot scriptVariables since it does not create a deep copy.
}

export class CastAbility extends Ability {
	constructor(ability, game) {
		super(ability, game);
		this.after = null;
		if (ability.after) {
			this.after = interpreter.buildAST("trigger", ability.id, ability.after, game);
		}
		this.afterPrecondition = null;
		if (ability.afterPrecondition) {
			this.afterPrecondition = interpreter.buildAST("triggerPrecondition", ability.id, ability.afterPrecondition, game);
		}
		this.triggerMetOnStacks = [];
		this.triggerPreconditionMet = false;
	}

	// does not call super.canActivate() to not perform a redundant and inaccurate cost check during spell casting
	canActivate(card, player, evaluatingPlayer = player) {
		return this.isConditionMet(player, evaluatingPlayer) && (this.after === null || (player.game.currentStack() && this.triggerMetOnStacks.includes(player.game.currentStack().index - 1)));
	}

	checkTrigger(player) {
		if (this.triggerPreconditionMet && (this.after === null || this.after.evalFull(new ScriptContext(this.card, player, this)).next().value.get(player))) {
			// no stack means we haven't started executing them yet
			this.triggerMetOnStacks.push(player.game.currentStack()?.index ?? 0);
		}
	}
	checkTriggerPrecondition(player) {
		this.triggerPreconditionMet = this.afterPrecondition === null || this.afterPrecondition.evalFull(new ScriptContext(this.card, player, this)).next().value.get(player);
	}
}

export class DeployAbility extends Ability {
	constructor(ability, game) {
		super(ability, game);
	}

	// does not call super.canActivate() to not perform a redundant and inaccurate cost check during item deployment
	canActivate(card, player, evaluatingPlayer = player) {
		return this.isConditionMet(player, evaluatingPlayer);
	}
}

export class OptionalAbility extends Ability {
	constructor(ability, game) {
		super(ability, game);
		this.turnLimit = interpreter.buildAST("turnLimit", ability.id, ability.turnLimit, game);
		this.globalTurnLimit = interpreter.buildAST("globalTurnLimit", ability.id, ability.globalTurnLimit, game);
		this.gameLimit = interpreter.buildAST("gameLimit", ability.id, ability.gameLimit, game);
		this.zoneDurationLimit = interpreter.buildAST("zoneDurationLimit", ability.id, ability.zoneDurationLimit, game);
		this.turnActivationCount = 0;
		this.zoneActivationCount = 0;
	}

	async canActivate(card, player, evaluatingPlayer = player) {
		let ctx = new ScriptContext(card, player, this, evaluatingPlayer);
		if (this.turnActivationCount >= this.turnLimit.evalFull(ctx).next().value.getJsNum(player)) return false;

		const gameLimit = this.gameLimit.evalFull(ctx).next().value.getJsNum(player);
		if (gameLimit !== Infinity && player.game.getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length >= gameLimit)
			return false;

		if (this.zoneActivationCount >= this.zoneDurationLimit.evalFull(ctx).next().value.getJsNum(player))
			return false;

		const globalTurnLimit = this.globalTurnLimit.evalFull(ctx).next().value.getJsNum(player);
		if (globalTurnLimit !== Infinity && player.game.currentTurn().getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length >= globalTurnLimit)
			return false;

		return super.canActivate(card, player, evaluatingPlayer);
	}

	successfulActivation() {
		this.turnActivationCount++;
		this.zoneActivationCount++;
	}

	zoneMoveReset(game) {
		super.zoneMoveReset(game);
		this.turnActivationCount = 0;
		this.zoneActivationCount = 0;
	}
}

export class FastAbility extends Ability {
	constructor(ability, game) {
		super(ability, game);
		this.turnLimit = interpreter.buildAST("turnLimit", ability.id, ability.turnLimit, game);
		this.globalTurnLimit = interpreter.buildAST("globalTurnLimit", ability.id, ability.globalTurnLimit, game);
		this.gameLimit = interpreter.buildAST("gameLimit", ability.id, ability.gameLimit, game);
		this.zoneDurationLimit = interpreter.buildAST("zoneDurationLimit", ability.id, ability.zoneDurationLimit, game);
		this.turnActivationCount = 0;
		this.zoneActivationCount = 0;
	}

	async canActivate(card, player, evaluatingPlayer = player) {
		let ctx = new ScriptContext(card, player, this, evaluatingPlayer);
		if (this.turnActivationCount >= this.turnLimit.evalFull(ctx).next().value.getJsNum(player)) return false;

		let gameLimit = this.gameLimit.evalFull(ctx).next().value.getJsNum(player);
		if (gameLimit !== Infinity && player.game.getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length >= gameLimit)
			return false;

		if (this.zoneActivationCount >= this.zoneDurationLimit.evalFull(ctx).next().value.getJsNum(player))
			return false;

		let globalTurnLimit = this.globalTurnLimit.evalFull(ctx).next().value.getJsNum(player);
		if (globalTurnLimit !== Infinity && player.game.currentTurn().getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length >= globalTurnLimit)
			return false;

		return super.canActivate(card, player, evaluatingPlayer);
	}

	successfulActivation() {
		this.turnActivationCount++;
		this.zoneActivationCount++;
	}

	zoneMoveReset(game) {
		super.zoneMoveReset(game);
		this.turnActivationCount = 0;
		this.zoneActivationCount = 0;
	}
}

export class TriggerAbility extends Ability {
	constructor(ability, game) {
		super(ability, game);
		this.mandatory = ability.mandatory;
		this.turnLimit = interpreter.buildAST("turnLimit", ability.id, ability.turnLimit, game);
		this.globalTurnLimit = interpreter.buildAST("globalTurnLimit", ability.id, ability.globalTurnLimit, game);
		this.gameLimit = interpreter.buildAST("gameLimit", ability.id, ability.gameLimit, game);
		this.zoneDurationLimit = interpreter.buildAST("zoneDurationLimit", ability.id, ability.zoneDurationLimit, game);
		this.during = null;
		if (ability.during) {
			this.during = interpreter.buildAST("during", ability.id, ability.during, game);
		}
		this.usedDuring = false;
		this.after = null;
		if (ability.after) {
			this.after = interpreter.buildAST("trigger", ability.id, ability.after, game);
		}
		this.afterPrecondition = null;
		if (ability.afterPrecondition) {
			this.afterPrecondition = interpreter.buildAST("triggerPrecondition", ability.id, ability.afterPrecondition, game);
		}
		this.triggerMetOnStacks = [];
		this.triggerPreconditionMet = false;
		this.turnActivationCount = 0;
		this.zoneActivationCount = 0;
	}

	async canActivate(card, player, evaluatingPlayer = player) {
		if (!this.triggerMetOnStacks.includes((player.game.currentStack()?.index ?? 0) - 1)) return false;

		let ctx = new ScriptContext(card, player, this, evaluatingPlayer);
		if (this.turnActivationCount >= this.turnLimit.evalFull(ctx).next().value.getJsNum(player)) return false;

		let gameLimit = this.gameLimit.evalFull(ctx).next().value.getJsNum(player);
		if (gameLimit !== Infinity && player.game.getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length >= gameLimit)
			return false;

		if (this.zoneActivationCount >= this.zoneDurationLimit.evalFull(ctx).next().value.getJsNum(player))
			return false;

		let globalTurnLimit = this.globalTurnLimit.evalFull(ctx).next().value.getJsNum(player);
		if (globalTurnLimit !== Infinity && player.game.currentTurn().getBlocks().filter(block => block instanceof blocks.AbilityActivation && block.ability.id === this.id && block.player === player).length >= globalTurnLimit)
			return false;

		return super.canActivate(card, player, evaluatingPlayer);
	}

	checkTrigger(player) {
		if (this.after === null) return;
		if (this.triggerPreconditionMet && this.after.evalFull(new ScriptContext(this.card, player, this)).next().value.get(player)) {
			// no stack means we haven't started executing them yet
			this.triggerMetOnStacks.push(player.game.currentStack()?.index ?? 0);
		}
	}
	checkTriggerPrecondition(player) {
		this.triggerPreconditionMet = this.afterPrecondition === null || this.afterPrecondition.evalFull(new ScriptContext(this.card, player, this)).next().value.get(player);
	}

	checkDuring(player) {
		if (this.during === null) return;
		if (!this.during.evalFull(new ScriptContext(this.card, player, this)).next().value.get(player)) {
			this.triggerMetOnStacks = [];
			this.usedDuring = false;
		} else if (!this.usedDuring && player.game.currentStack()) {
			this.triggerMetOnStacks.push(player.game.currentStack().index - 1);
		}
	}

	successfulActivation() {
		this.turnActivationCount++;
		this.zoneActivationCount++;
		this.triggerMetOnStacks = [];
		if (this.during) {
			this.usedDuring = true;
		}
	}

	zoneMoveReset(game) {
		super.zoneMoveReset(game);
		this.turnActivationCount = 0;
		this.zoneActivationCount = 0;
		this.triggerMetOnStacks = [];
	}
}

export class StaticAbility extends BaseAbility {
	constructor(ability, game) {
		super(ability, game);
		this.modifier = interpreter.buildAST("modifier", ability.id, ability.modifier, game);
		this.applyTo = interpreter.buildAST("applyTarget", ability.id, ability.applyTo, game);
		this.zoneEnterTimingIndex = 0;
		this.mandatory = ability.mandatory; // for action-replacing abilities

		// all of these are for cancel or replacement static abilities.
		this.gameLimit = interpreter.buildAST("gameLimit", ability.id, ability.gameLimit, game);
		this.turnLimit = interpreter.buildAST("turnLimit", ability.id, ability.turnLimit, game);
		this.zoneDurationLimit = interpreter.buildAST("zoneDurationLimit", ability.id, ability.zoneDurationLimit, game);
		this.turnApplicationCount = 0;
		this.zoneApplicationCount = 0;
	}

	getTargets(player, evaluatingPlayer = player) {
		if (this.isConditionMet(player, evaluatingPlayer = player)) {
			return this.applyTo.evalFull(new ScriptContext(this.card, player, this, evaluatingPlayer)).next().value.get(player);
		}
		return [];
	}

	getModifier() {
		const player = this.card.currentOwner();
		return this.modifier.evalFull(new ScriptContext(this.card, player, this)).next().value.get(player);
	}

	// only for replacement and cancel abilities
	canApply(card, player, evaluatingPlayer = player) {
		if (this.isCancelled) return false;

		if (!this.isConditionMet(player, evaluatingPlayer)) return false;

		const ctx = new ScriptContext(card, player, this, evaluatingPlayer);
		if (this.turnApplicationCount >= this.turnLimit.evalFull(ctx).next().value.getJsNum(player)) return false;

		if (this.zoneApplicationCount >= this.zoneDurationLimit.evalFull(ctx).next().value.getJsNum(player)) return false;

		let gameLimit = this.gameLimit.evalFull(ctx).next().value.getJsNum(player);
		if (gameLimit !== Infinity && player.game.getTimings().map(timing => timing.staticAbilitiesApplied.filter(a => a.player === player && a.ability.id === this.id)).flat().length >= gameLimit)
			return false;

		return super.canActivate(card, player, evaluatingPlayer);
	}

	successfulApplication() {
		this.turnApplicationCount++;
		this.zoneApplicationCount++;
	}

	zoneMoveReset(game) {
		super.zoneMoveReset(game);
		this.zoneEnterTimingIndex = game.nextTimingIndex - 1;
		this.turnApplicationCount = 0;
		this.zoneApplicationCount = 0;
	}
}