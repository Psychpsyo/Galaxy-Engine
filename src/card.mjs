// This module exports the Card class which represents a specific card in a Game.

import {CardValues, ObjectValues} from "./objectValues.mjs";
import {ScriptContext, TargetObjects} from "./cdfScriptInterpreter/structs.mjs";
import {parseCdfValues} from "./cdfParser.mjs";
import * as abilities from "./abilities.mjs";
import * as interpreter from "./cdfScriptInterpreter/interpreter.mjs";
import * as blocks from "./blocks.mjs";
import * as actions from "./actions.mjs";
import * as stepGenerators from "./stepGenerators.mjs";

export class BaseCard {
	constructor(player, cardId, isToken, values, deckLimit, equipableTo, turnLimit, condition) {
		this.owner = player;
		this.cardId = cardId;
		this.isToken = isToken;
		this.isRemovedToken = false;
		this.deckLimit = deckLimit;
		this.equipableTo = equipableTo;
		this.turnLimit = turnLimit;
		this.condition = condition;

		this.values = values;
		this.cdfScriptType = "card";

		this.zone = null;
		this.placedTo = null;
		this.index = -1;
		this.lastFieldSidePlayer = null;

		this.counters = {};
		this.equippedTo = null;
		this.equipments = [];
		this.attacksMadeThisTurn = 0;
		this.canAttackAgain = false;
		this.isAttacking = false;
		this.isAttackTarget = false;
		this.inRetire = null;
		this.inAttackDeclarationBlock = null;

		this.hiddenFor = [];
		this.globalId = 0;

		// set ability references to this card
		for (const ability of this.values.initial.abilities) {
			ability.card = this;
		}
		for (const ability of this.values.base.abilities) {
			ability.card = this;
		}
		for (const ability of this.values.current.abilities) {
			ability.card = this;
		}
	}

	// makes a snapshot of this card.
	snapshot(equippedToSnapshot, equipmentSnapshot) {
		return new SnapshotCard(this, equippedToSnapshot, equipmentSnapshot);
	}
	// always returns the current, non-snapshot version of a card or null if that doesn't exist.
	current() {
		return this.owner.game.currentCards.get(this.globalId) ?? null;
	}

	sharesTypeWith(card) {
		let ownTypes = this.values.current.types;
		for (let type of card.values.current.types) {
			if (ownTypes.includes(type)) {
				return true;
			}
		}
		return false;
	}

	currentOwner() {
		// a card that is not in a zone belongs to its owner as it is in the process of being summoned/cast/deployed
		return this.zone?.player ?? this.placedTo?.player ?? this.owner;
	}

	hideFrom(player) {
		if (!this.hiddenFor.includes(player)) {
			this.hiddenFor.push(player);
		}
	}
	showTo(player) {
		let index = this.hiddenFor.indexOf(player);
		if (index >= 0) {
			this.hiddenFor.splice(index, 1);
		}
	}

	getSummoningCost(player) {
		const costActions = [];
		if (this.values.current.level > 0) {
			costActions.push([new actions.LoseMana(player, this.values.current.level)]);
		}
		return stepGenerators.arrayStepGenerator(costActions);
	}
	getCastingCost(player, scriptTargets) {
		const costActions = [];
		if (this.values.current.level > 0) {
			costActions.push([new actions.LoseMana(player, this.values.current.level)]);
		}
		if (this.values.current.cardTypes.includes("enchantSpell")) {
			costActions.unshift([new actions.SelectEquipableUnit(player, this)]);
		}
		const generators = [
			stepGenerators.arrayStepGenerator(costActions)
		];
		for (let ability of this.values.current.abilities) {
			if (ability instanceof abilities.CastAbility) {
				if (ability.cost) {
					generators.push(stepGenerators.abilityStepGenerator(ability, ability.makeMainContext(this, player, scriptTargets), "cost"));
				}
				break;
			}
		}
		// Lifting the card out of the hand needs to be the last part of its cost so that the validity checker for its exec does not have access to it during its effect
		generators.push(stepGenerators.arrayStepGenerator([[new actions.LiftCardOutOfCurrentZone(player, this)]]));
		return stepGenerators.combinedStepGenerator(generators);
	}
	getDeploymentCost(player, scriptTargets) {
		const costActions = [];
		if (this.values.current.level > 0) {
			costActions.push([new actions.LoseMana(player, this.values.current.level)]);
		}
		if (this.values.current.cardTypes.includes("equipableItem")) {
			costActions.unshift([new actions.SelectEquipableUnit(player, this)]);
		}
		const generators = [
			stepGenerators.arrayStepGenerator(costActions)
		];
		for (let ability of this.values.current.abilities) {
			if (ability instanceof abilities.DeployAbility) {
				if (ability.cost) {
					generators.push(stepGenerators.abilityStepGenerator(ability, ability.makeMainContext(this, player, scriptTargets), "cost"));
				}
				break;
			}
		}
		// Lifting the card out of the hand needs to be the last part of its cost so that the validity checker for its exec does not have access to it during its effect
		generators.push(stepGenerators.arrayStepGenerator([[new actions.LiftCardOutOfCurrentZone(player, this)]]));
		return stepGenerators.combinedStepGenerator(generators);
	}

	async canSummon(checkPlacement, player) {
		if (!this.values.current.cardTypes.includes("unit")) {
			return false;
		}
		const stepRunner = new stepGenerators.StepRunner(() => this.getSummoningCost(player), player.game);
		stepRunner.isCost = true;
		const costOptionTree = new stepGenerators.OptionTreeNode(player.game, stepRunner, () => !checkPlacement || player.unitZone.getFreeSpaceCount() > 0);
		return costOptionTree.isValid();
	}
	// If checkPlacement is false, only the casting conditions that the rules care about will be evaluated, not if the card can actually sucessfully be placed on the field
	getCastabilityCostOptionTree(checkPlacement, player, evaluatingPlayer = player) {
		if (!this.values.current.cardTypes.includes("spell")) {
			return null;
		}
		const scriptTargets = new TargetObjects();
		const cardCtx = new ScriptContext(this, player, null, evaluatingPlayer, scriptTargets);
		if ((player.game.currentTurn().getBlocks().filter(block => block instanceof blocks.CastSpell && block.card.cardId === this.cardId && block.player === player).length >= this.turnLimit.evalFull(cardCtx).next().value.getJsNum(player)) ||
			(this.condition !== null && !this.condition.evalFull(cardCtx).next().value.getJsBool(player))
		) {
			return null;
		}

		// the card must be out of any zone which can only happen if the LiftCardOutOfCurrentZone action of the cost was able to lift it from the zone it was supposed to be cast from.
		let endOfTreeCheck = () => this.zone === null && (!checkPlacement || player.spellItemZone.getFreeSpaceCount() > 0);
		// find cast ability
		for (const ability of this.values.current.abilities) {
			if (ability instanceof abilities.CastAbility) {
				if (!ability.canActivate(this, player, evaluatingPlayer)) {
					return null;
				}
				endOfTreeCheck = () => {
					for (const section of ["exec", "onComplete"]) {
						if (ability[section] && !ability[section].hasAllTargets(new ScriptContext(this, player, ability, evaluatingPlayer, scriptTargets)))
							return false;
					}
					if (this.zone !== null)
						return false;
					if (checkPlacement && !player.spellItemZone.getFreeSpaceCount() > 0)
						return false;
					return true;
				}
			}
		}

		const stepRunner = new stepGenerators.StepRunner(() => this.getCastingCost(player, scriptTargets), player.game);
		stepRunner.isCost = true;
		return new stepGenerators.OptionTreeNode(player.game, stepRunner, endOfTreeCheck);
	}
	// If checkPlacement is false, only the deployment conditions that the rules care about will be evaluated, not if the card can actually sucessfully be placed on the field
	async getDeployabilityCostOptionTree(checkPlacement, player, evaluatingPlayer = player) {
		if (!this.values.current.cardTypes.includes("item")) {
			return null;
		}
		const scriptTargets = new TargetObjects();
		const cardCtx = new ScriptContext(this, player, null, evaluatingPlayer, scriptTargets);
		if ((player.game.currentTurn().getBlocks().filter(block => block instanceof blocks.DeployItem && block.card.cardId === this.cardId && block.player === player).length >= this.turnLimit.evalFull(cardCtx).next().value.getJsNum(player)) ||
			(this.condition !== null && !this.condition.evalFull(cardCtx).next().value.getJsBool(player))
		) {
			return null;
		}

		// the card must be out of any zone which can only happen if the LiftCardOutOfCurrentZone action of the cost was able to lift it from the zone it was supposed to be cast from.
		let endOfTreeCheck = () => this.zone === null && (!checkPlacement || player.spellItemZone.getFreeSpaceCount() > 0);
		// find deploy ability
		for (const ability of this.values.current.abilities) {
			if (ability instanceof abilities.DeployAbility) {
				if (!ability.canActivate(this, player, evaluatingPlayer)) {
					return null;
				}
				endOfTreeCheck = () => {
					for (const section of ["exec", "onComplete"]) {
						if (ability[section] && !ability[section].hasAllTargets(new ScriptContext(this, player, ability, evaluatingPlayer, scriptTargets)))
							return false;
					}
					if (this.zone !== null)
						return false;
					if (checkPlacement && !player.spellItemZone.getFreeSpaceCount() > 0)
						return false;
					return true;
				}
			}
		}

		const stepRunner = new stepGenerators.StepRunner(() => this.getDeploymentCost(player, scriptTargets), player.game);
		stepRunner.isCost = true;
		return new stepGenerators.OptionTreeNode(player.game, stepRunner, endOfTreeCheck);
	}

	// Does not check if the card can be declared to attack, only if it is allowed to be/stay in an attack declaration.
	canAttack() {
		if (this.isRemovedToken) return false;
		if (!this.values.current.cardTypes.includes("unit")) return false;
		if (!this.values.current.canAttack) return false;
		return this.attacksMadeThisTurn < this.values.current.attackRights || this.canAttackAgain;
	}

	static sort(a, b) {
		if (a.cardId < b.cardId) {
			return -1;
		}
		if (a.cardId > b.cardId) {
			return 1;
		}
		return 0;
	}
}

export class Card extends BaseCard {
	constructor(player, cdf) {
		let data = parseCdfValues(cdf, player.game);
		let baseCardTypes = [data.cardType];
		if (data.cardType == "token") {
			baseCardTypes = ["unit"];
		} else if (["standardSpell", "continuousSpell", "enchantSpell"].includes(data.cardType)) {
			baseCardTypes.push("spell");
		} else if (["standardItem", "continuousItem", "equipableItem"].includes(data.cardType)) {
			baseCardTypes.push("item");
		}
		super(player, data.id,
			data.cardType === "token",
			new ObjectValues(
				new CardValues(
					baseCardTypes,
					[data.name ?? data.id],
					data.level ?? 0,
					data.types ?? [],
					data.attack ?? null,
					data.defense ?? null,
					data.abilities.map(ability => interpreter.makeAbility(ability, player.game)),
					baseCardTypes.includes("unit")? 1 : null,
					baseCardTypes.includes("unit")? true : null,
					baseCardTypes.includes("unit")? true : null
				)
			),
			data.deckLimit,
			interpreter.buildAST("equipableTo", data.id, data.equipableTo, player.game),
			interpreter.buildAST("cardTurnLimit", data.id, data.turnLimit, player.game),
			data.condition? interpreter.buildAST("cardCondition", data.id, data.condition, player.game) : null
		);
		this.globalId = ++player.game.lastGlobalCardId;
		player.game.currentCards.set(this.globalId, this);
		this.globalIdHistory = [];
	}

	// this card needs to start being counted as an entirely new card
	invalidateSnapshots() {
		this.globalIdHistory.push(this.globalId);
		this.owner.game.currentCards.delete(this.globalId);
		this.globalId = ++this.owner.game.lastGlobalCardId;
		this.owner.game.currentCards.set(this.globalId, this);
		// invalidate ability snapshots as well
		for (const ability of this.values.getAllAbilities()) {
			ability.invalidateSnapshots(this.owner.game);
		}
	}
	// the reverse of the above
	undoInvalidateSnapshots() {
		for (const ability of this.values.getAllAbilities()) {
			ability.undoInvalidateSnapshots(this.owner.game);
		}
		this.owner.game.currentCards.delete(this.globalId);
		this.globalId = this.globalIdHistory.pop();
		this.owner.game.currentCards.set(this.globalId, this);
		this.owner.game.lastGlobalCardId--;
	}

	endOfTurnReset() {
		this.attacksMadeThisTurn = 0;
		this.canAttackAgain = false;
		for (let ability of this.values.current.abilities) {
			if (ability instanceof abilities.OptionalAbility || ability instanceof abilities.FastAbility || ability instanceof abilities.TriggerAbility) {
				ability.turnActivationCount = 0;
			}
		}
	}
}

// A card with all its values frozen so it can be held in internal logs of what Actions happened in a Step.
// These are also used in many actions undo() functions as a state to restore a card to.
export class SnapshotCard extends BaseCard {
	#actualGlobalId;
	#actualCard;
	constructor(card, equippedToSnapshot, equipmentSnapshot) {
		super(card.owner, card.cardId, card.isToken, card.values.snapshot(), card.deckLimit, card.equipableTo, card.turnLimit, card.condition);
		this.isRemovedToken = card.isRemovedToken;

		if (equippedToSnapshot) {
			this.equippedTo = equippedToSnapshot;
		} else if (card.equippedTo) {
			this.equippedTo = card.equippedTo.snapshot(undefined, this);
		}
		this.equipments = card.equipments.map((equipment => {
			if (equipmentSnapshot === equipment) {
				return equipmentSnapshot;
			}
			return equipment.snapshot(this);
		}).bind(this));
		this.zone = card.zone;
		this.placedTo = card.placedTo;
		this.index = card.index;
		this.lastFieldSidePlayer = card.lastFieldSidePlayer;

		for (const [counter, amount] of Object.entries(card.counters)) {
			this.counters[counter] = amount;
		}
		this.attacksMadeThisTurn = card.attacksMadeThisTurn;
		this.canAttackAgain = card.canAttackAgain;
		this.isAttacking = card.isAttacking;
		this.isAttackTarget = card.isAttackTarget;
		this.inRetire = card.inRetire;
		this.inAttackDeclarationBlock = card.inAttackDeclarationBlock;

		this.hiddenFor = [...card.hiddenFor];
		this.globalId = card.globalId;

		this.#actualGlobalId = card.globalId; // not to be changed by other things, this is what a card will be restored to, not what the snapshot counts as.
		this.#actualCard = card; // will not be cleared by card moving and is only for restoring a card on undo
	}

	// makes a snapshot of this card.
	snapshot(equippedToSnapshot, equipmentSnapshot) {
		return this;
	}

	// restores this snapshot to the card it is a snapshot of.
	// Note: Do not use this SnapshotCard after restoring!
	restore() {
		this.#actualCard.isRemovedToken = this.isRemovedToken;

		// some cards just need to be removed from their zone back into nowhere.
		if (this.zone === null && this.placedTo === null) {
			this.#actualCard.zone?.remove(this.#actualCard);
		} else {
			this.zone?.add(this.#actualCard, this.index, false);
			this.placedTo?.place(this.#actualCard, this.index);
		}
		if (this.#actualCard.globalId != this.#actualGlobalId) {
			this.#actualCard.undoInvalidateSnapshots();
		}
		this.#actualCard.lastFieldSidePlayer = this.lastFieldSidePlayer;

		this.#actualCard.hiddenFor = [...this.hiddenFor];

		this.#actualCard.values = this.values.unsnapshot();

		this.#actualCard.equippedTo = this.equippedTo?.#actualCard ?? null;
		if (this.equippedTo && !this.#actualCard.equippedTo.equipments.includes(this.#actualCard)) {
			this.#actualCard.equippedTo.equipments.push(this.#actualCard);
		}
		this.#actualCard.equipments = this.equipments.map(equipment => equipment.#actualCard);
		for (const equipment of this.#actualCard.equipments) {
			equipment.equippedTo = this.#actualCard;
		}

		for (const [counter, amount] of Object.entries(this.counters)) {
			this.#actualCard.counters[counter] = amount;
		}
		this.#actualCard.attacksMadeThisTurn = this.attacksMadeThisTurn;
		this.#actualCard.canAttackAgain = this.canAttackAgain;
		this.#actualCard.isAttackTarget = this.isAttackTarget;
		this.#actualCard.isAttacking = this.isAttacking;
		if (this.isAttackTarget) {
			this.owner.game.currentAttackDeclaration.target = this.#actualCard;
		}
		if (this.isAttacking) {
			if (this.owner.game.currentAttackDeclaration.attackers.indexOf(this.#actualCard) == -1) {
				this.owner.game.currentAttackDeclaration.attackers.push(this.#actualCard);
			}
		}
		this.#actualCard.inRetire = this.inRetire;
		if (this.inRetire && !this.inRetire.units.includes(this.#actualCard)) {
			this.inRetire.units.push(this.#actualCard);
		}
		this.#actualCard.inAttackDeclarationBlock = this.inAttackDeclarationBlock;
		if (this.inAttackDeclarationBlock && !this.inAttackDeclarationBlock.attackers.includes(this.#actualCard)) {
			this.inAttackDeclarationBlock.attackers.push(this.#actualCard);
		}
	}
}