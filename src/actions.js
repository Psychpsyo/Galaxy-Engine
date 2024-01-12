import * as ast from "./cdfScriptInterpreter/astNodes.js";
import * as events from "./events.js";
import * as requests from "./inputRequests.js";
import * as zones from "./zones.js";
import {BaseCard} from "./card.js";
import {Player} from "./player.js";
import {ScriptContext, ScriptValue} from "./cdfScriptInterpreter/structs.js";
import {Timing} from "./timings.js";

// helper functions
function getAvailableZoneSlots(zone) {
	let slots = [];
	for (let i = 0; i < zone.cards.length; i++) {
		let slotCard = zone.get(i);
		if (slotCard === null) {
			slots.push(i);
		}
	}
	return slots;
}
function* queryZoneSlot(player, zone) {
	let zoneSlotRequest = new requests.chooseZoneSlot.create(player, zone, getAvailableZoneSlots(zone));
	let zoneSlotResponse = yield [zoneSlotRequest];
	return requests.chooseZoneSlot.validate(zoneSlotResponse.value, zoneSlotRequest);
}
// gets the list that an 'undo' timing needs to be put into for actions that can be applied until a certain point
function getUntilTimingList(ctxPlayer, until) {
	switch (until) {
		case "endOfTurn": {
			return ctxPlayer.game.currentTurn().endOfTurnTimings;
		}
		case "endOfNextTurn": {
			return ctxPlayer.game.endOfUpcomingTurnTimings[0];
		}
		case "endOfYourNextTurn": {
			let currentlyYourTurn = ctxPlayer.game.currentTurn().player === ctxPlayer;
			return ctxPlayer.game.endOfUpcomingTurnTimings[currentlyYourTurn? 1 : 0];
		}
		case "endOfOpponentNextTurn": {
			let currentlyOpponentTurn = ctxPlayer.game.currentTurn().player !== ctxPlayer;
			return ctxPlayer.game.endOfUpcomingTurnTimings[currentlyOpponentTurn? 1 : 0];
		}
	}
}
// gets the current version of a game object, no matter if it is a card or player
function getObjectCurrent(object) {
	if (object instanceof BaseCard) {
		return object.current();
	}
	return object;
}

// Base class for any action in the game.
export class Action {
	constructor(player, properties = {}) {
		this.player = player;
		this.timing = null; // Is set by the Timing itself
		this.costIndex = -1; // If this is positive, it indicates that this action is to be treated as a cost, together with other actions of the same costIndex
		this.properties = properties;
		this.isCancelled = false; // even cancelled timings stay in the game logs for abilities like that of 'Firewall Golem'
	}

	// Returns the event that represents this action.
	// After run() finishes, this class should only hold references to card snapshots, not actual cards so it serves as a record of what it did
	async* run() {}

	undo() {}

	isImpossible() {
		return false;
	}
	isPossible() {
		return !this.isImpossible();
	}
	isFullyPossible() {
		return this.isPossible();
	}

	// This is necessary for things like Destroys that also need to cancel their inner action.
	// Returns the action(s) that actually got cancelled.
	setIsCancelled() {
		this.isCancelled = true;
		return [this];
	}

	// Used during replacement calculation
	isIdenticalTo(other) {
		return false;
	}
}

export class ChangeMana extends Action {
	constructor(player, amount) {
		super(player);
		this.amount = amount;
	}

	async* run() {
		this.player.mana += this.amount;
		return events.createManaChangedEvent(this.player);
	}

	undo() {
		this.player.mana -= this.amount;
		return events.createManaChangedEvent(this.player);
	}

	isImpossible() {
		return this.player.mana == 0 && this.amount < 0;
	}
	isFullyPossible() {
		return this.player.mana + this.amount >= 0;
	}
}

export class ChangeLife extends Action {
	constructor(player, amount) {
		super(player);
		this.amount = amount;
		this._oldAmount = null;
	}

	async* run() {
		this._oldAmount = this.player.life;
		this.player.life = Math.max(this.player.life + this.amount, 0);
		if (this.player.life === 0) {
			this.player.next().victoryConditions.push("lifeZero");
		}
		return events.createLifeChangedEvent(this.player);
	}

	undo() {
		if (this.player.life === 0) {
			this.player.next().victoryConditions.pop();
		}
		this.player.life = this._oldAmount;
		return events.createLifeChangedEvent(this.player);
	}

	isFullyPossible() {
		return this.player.life + this.amount >= 0;
	}
}

export class Draw extends Action {
	constructor(player, amount) {
		super(player);
		this.amount = amount;
		this.drawnCards = [];
	}

	async* run() {
		if (this.amount > this.player.deckZone.cards.length) {
			this.player.next().victoryConditions.push("drawFromEmptyDeck");
			return null;
		}
		let drawnCards = [];
		for (let i = 0; i < this.amount; i++) {
			let drawnCard = this.player.deckZone.cards[this.player.deckZone.cards.length - 1];
			this.drawnCards.push(drawnCard.snapshot());
			drawnCards.push(drawnCard);
			this.player.handZone.add(drawnCard, this.player.handZone.cards.length);
			drawnCard.showTo(this.player);
		}
		for (let i = 0; i < drawnCards.length; i++) {
			this.drawnCards[i].globalId = drawnCards[i].globalId;
		}
		return events.createCardsDrawnEvent(this.player, this.drawnCards);
	}

	undo() {
		if (this.drawnCards.length > 0) {
			let movedCards = [];
			for (let i = this.drawnCards.length - 1; i >= 0; i--) {
				let card = this.drawnCards[i];
				movedCards.push({fromZone: card.current().zone, fromIndex: card.current().index, toZone: card.zone, toIndex: card.index});
				card.restore();
			}
			return events.createUndoCardsMovedEvent(movedCards);
		}
		if (this.amount > this.player.deckZone.cards.length) {
			this.player.next().victoryConditions.pop();
		}
	}
}

// places a card on the field without moving it there yet.
export class Place extends Action {
	constructor(player, card, zone) {
		super(player);
		this.card = card;
		this.zone = zone;
		this.targetIndex = null;
	}

	async* run() {
		this.targetIndex = yield* queryZoneSlot(this.player, this.zone);
		const card = this.card.current();
		this.card = this.card.snapshot();
		card.hiddenFor = [];
		let cardPlacedEvent = events.createCardPlacedEvent(this.player, this.card, this.zone, this.targetIndex);
		this.zone.place(card, this.targetIndex);
		return cardPlacedEvent;
	}

	undo() {
		this.zone.placed[this.targetIndex] = null;
		this.card.restore();
		return events.createUndoCardsMovedEvent([
			{fromZone: this.zone, fromIndex: this.targetIndex, toZone: this.card.zone, toIndex: this.card.index}
		]);
	}

	isImpossible() {
		if (this.card.current() === null) return true;
		return getAvailableZoneSlots(this.zone).length < this.timing.actions.filter(action => action instanceof Place).length;
	}

	isIdenticalTo(other) {
		if (this.constructor !== other.constructor) return false;
		return this.card.current() === other.card.current();
	}
}

export class Summon extends Action {
	constructor(player, placeAction, reason, source) {
		let properties = {dueTo: reason, from: new ScriptValue("zone", [placeAction.card.zone])};
		if (source) { // standard summons have no source
			properties.by = source;
		}
		super(player, properties);
		this._placeAction = placeAction;
		this.card = placeAction.card.current();
	}

	async* run() {
		const card = this.card.current();
		this.card = this.card.snapshot();
		let summonEvent = events.createCardSummonedEvent(this.player, this.card, this._placeAction.zone, this._placeAction.targetIndex);
		this._placeAction.zone.add(card, this._placeAction.targetIndex);
		this._placeAction.card.globalId = card.globalId;
		this.card.globalId = card.globalId;
		return summonEvent;
	}

	undo() {
		this.zone.remove(this.card.current(), this._placeAction.targetIndex);
	}

	isImpossible() {
		if (this.card.current() === null) return true;
		let slotCard = this._placeAction.zone.get(this._placeAction.targetIndex);
		return slotCard != null && slotCard != this.card.current();
	}

	isIdenticalTo(other) {
		if (this.constructor !== other.constructor) return false;
		return this.card.current() === other.card.current();
	}
}

export class Deploy extends Action {
	constructor(player, placeAction, reason, source) {
		let properties = {dueTo: reason, from: new ScriptValue("zone", [placeAction.card.zone])};
		if (source) { // only exists if deployed by card effect
			properties.by = source;
		}
		super(player, properties);
		this._placeAction = placeAction;
		this.card = placeAction.card.current();
	}

	async* run() {
		const card = this.card.current();
		this.card = this.card.snapshot();
		let deployEvent = events.createCardDeployedEvent(this.player, this.card, this._placeAction.zone, this._placeAction.targetIndex);
		if (this._placeAction.card.current()) {
			this._placeAction.zone.add(card, this._placeAction.targetIndex);
			this._placeAction.card.globalId = card.globalId;
			this.card.globalId = card.globalId;
		}
		return deployEvent;
	}

	undo() {
		this.zone.remove(this.card.current(), this._placeAction.targetIndex);
	}

	isImpossible() {
		if (this.card.current() === null) return true;
		let slotCard = this._placeAction.zone.get(this._placeAction.targetIndex);
		return slotCard != null && slotCard != this.card.current();
	}

	isIdenticalTo(other) {
		if (this.constructor !== other.constructor) return false;
		return this.card.current() === other.card.current();
	}
}

export class Cast extends Action {
	constructor(player, placeAction, reason, source) {
		let properties = {dueTo: reason, from: new ScriptValue("zone", [placeAction.card.zone])};
		if (source) { // only exists if cast by card effect
			properties.by = source;
		}
		super(player, properties);
		this._placeAction = placeAction;
		this.card = placeAction.card.current();
	}

	async* run() {
		const card = this.card.current();
		this.card = this.card.snapshot();
		let castEvent = events.createCardCastEvent(this.player, this.card, this._placeAction.zone, this._placeAction.targetIndex);
		if (this._placeAction.card.current()) {
			this._placeAction.zone.add(card, this._placeAction.targetIndex);
			this._placeAction.card.globalId = card.globalId;
			this.card.globalId = card.globalId;
		}
		return castEvent;
	}

	undo() {
		this.zone.remove(this.card.current(), this._placeAction.targetIndex);
	}

	isImpossible() {
		if (this.card.current() === null) return true;
		let slotCard = this._placeAction.zone.get(this._placeAction.targetIndex);
		return slotCard != null && slotCard != this.card.current();
	}

	isIdenticalTo(other) {
		if (this.constructor !== other.constructor) return false;
		return this.card.current() === other.card.current();
	}
}

export class Move extends Action {
	constructor(player, card, zone, targetIndex) {
		super(player);
		this.card = card;
		this.zone = zone;
		this.targetIndex = targetIndex;
		this.insertedIndex = null;
	}

	async* run() {
		const card = this.card.current();
		this.card = this.card.snapshot();
		if (this.targetIndex === null) {
			if (this.zone instanceof zones.DeckZone) {
				this.insertedIndex = this.zone.cards.length;
			} else {
				this.insertedIndex = yield* queryZoneSlot(this.player, this.zone);
			}
		} else if (this.targetIndex === -1) {
			this.insertedIndex = this.zone.cards.length;
		}
		this.zone.add(card, this.insertedIndex);
		this.card.globalId = card.globalId;
		return events.createCardMovedEvent(this.player, this.card, this.zone, this.insertedIndex);
	}

	undo() {
		let event = events.createUndoCardsMovedEvent([
			{fromZone: this.card.current().zone, fromIndex: this.card.current().index, toZone: this.card.zone, toIndex: this.card.index}
		]);
		this.card.restore();
		return event;
	}

	isImpossible() {
		if (!this.card.current()) return true;
		if (this.card.current().isRemovedToken) return true;
		if (this.card.current().zone?.type == "partner") return true;
		if (this.zone instanceof zones.FieldZone && getAvailableZoneSlots(this.zone).length === 0) return true;
		return false;
	}
	isFullyPossible() {
		if (this.zone instanceof zones.FieldZone && getAvailableZoneSlots(this.zone).length < this.timing.actions.filter(action => action instanceof Move).length) return false;
		return this.isPossible();
	}

	isIdenticalTo(other) {
		if (this.constructor !== other.constructor) return false;
		return this.card.current() === other.card.current();
	}
}

export class Swap extends Action {
	constructor(player, cardA, cardB, transferEquipments) {
		super(player);
		this.cardA = cardA;
		this.cardB = cardB;
		this.transferEquipments = transferEquipments;
	}

	async* run() {
		let cardA = this.cardA.current();
		let cardB = this.cardB.current();
		this.cardA = this.cardA.snapshot();
		this.cardB = this.cardB.snapshot();

		this.cardA.zone.remove(cardA);
		this.cardB.zone.remove(cardB);
		this.cardA.zone.add(cardB, this.cardA.index);
		this.cardB.zone.add(cardA, this.cardB.index);

		this.cardA.globalId = cardA.globalId;
		this.cardB.globalId = cardB.globalId;

		if (this.transferEquipments) {
			if (cardA.zone instanceof zones.FieldZone) {
				for (const equipment of this.cardB.equipments) {
					cardA.equipments.push(equipment.current());
					equipment.current().equippedTo = cardA;
				}
			}
			if (cardB.zone instanceof zones.FieldZone) {
				for (const equipment of this.cardA.equipments) {
					cardB.equipments.push(equipment.current());
					equipment.current().equippedTo = cardB;
				}
			}
		}

		return events.createCardsSwappedEvent(this.player, this.cardA, this.cardB, this.transferEquipments);
	}

	undo() {
		let event = events.createUndoCardsSwappedEvent(this.cardA, this.cardB);

		this.cardA.current().zone.remove(this.cardA.current());
		this.cardB.current().zone.remove(this.cardB.current());
		this.cardA.restore();
		this.cardB.restone();

		return event;
	}

	isImpossible() {
		if (this.cardA.current() === null) return true;
		if (this.cardB.current() === null) return true;
		if ((this.cardA.isToken && !(this.cardB.zone instanceof FieldZone)) ||
			(this.cardB.isToken && !(this.cardA.zone instanceof FieldZone)) ||
			this.cardA.isRemovedToken ||
			this.cardB.isRemovedToken
		) {
			return true;
		}
		return false;
	}
}

export class EstablishAttackDeclaration extends Action {
	constructor(player, attackers) {
		super(player);
		this.attackers = attackers;
		this.attackTarget = null;
	}

	// TODO: Is this impossible if no attackers left?
	async* run() {
		// determine possible attack targets
		let eligibleUnits = this.player.next().partnerZone.cards.concat(this.player.next().unitZone.cards.filter(card => card !== null));
		if (eligibleUnits.length > 1) {
			eligibleUnits.shift();
		}

		// send selection request
		let targetSelectRequest = new requests.chooseCards.create(this.player, eligibleUnits, [1], "selectAttackTarget");
		let response = yield [targetSelectRequest];
		if (response.type != "chooseCards") {
			throw new Error("Incorrect response type supplied during attack target selection. (expected \"chooseCards\", got \"" + response.type + "\" instead)");
		}
		this.attackTarget = requests.chooseCards.validate(response.value, targetSelectRequest)[0];

		// handle remaining attack rights
		this.attackers = this.attackers.map(attacker => attacker.snapshot());
		this.attackTarget = this.attackTarget.snapshot();

		return events.createAttackDeclarationEstablishedEvent(this.player, this.attackTarget, this.attackers);
	}
}

export class DealDamage extends Action {
	constructor(player, amount) {
		super(player);
		this.amount = amount;
		this.oldAmount = null;
	}

	async* run() {
		this.oldAmount = this.player.life;
		this.player.life = Math.max(this.player.life - this.amount, 0);
		if (this.player.life == 0) {
			this.player.next().victoryConditions.push("lifeZero");
		}
		return events.createDamageDealtEvent(this.player, this.amount);
	}

	undo() {
		if (this.player.life === 0) {
			this.player.next().victoryConditions.pop();
		}
		this.player.life = this.oldAmount;
		return events.createLifeChangedEvent(this.player);
	}
}

export class Discard extends Action {
	constructor(player, card, reason, source) {
		let properties = {dueTo: reason, from: new ScriptValue("zone", [card.zone])};
		if (source) { // source only exists if discarded by card effect
			properties.by = source;
		}
		super(player, properties);
		this.card = card;
	}

	async* run() {
		const card = this.card.current();
		this.card = this.card.snapshot();
		let event = events.createCardDiscardedEvent(this.card, this.card.owner.discardPile);
		this.card.owner.discardPile.add(this.card.current(), this.card.owner.discardPile.cards.length);
		this.card.globalId = card.globalId;
		return event;
	}

	undo() {
		let event = events.createUndoCardsMovedEvent([
			{fromZone: this.card.current().zone, fromIndex: this.card.current().index, toZone: this.card.zone, toIndex: this.card.index}
		]);
		this.card.restore();
		return event;
	}

	isImpossible() {
		if (this.card.current().zone?.type === "partner") {
			return true;
		}
		return false;
	}

	isIdenticalTo(other) {
		if (this.constructor !== other.constructor) return false;
		return this.card.current() === other.card.current();
	}
}

export class Destroy extends Action {
	constructor(discard) {
		super(discard.player, discard.properties);
		this.discard = discard;
	}

	async* run() {
		this.discard.card = this.discard.card.snapshot();
		return events.createCardDestroyedEvent(this.discard.card, this.discard.card.owner.discardPile);
		// destroying a card doesn't do anything.
		// Only the accompanying discard actually does something
	}

	isImpossible() {
		if (this.discard.card.zone?.type == "partner") {
			return true;
		}
		return false;
	}

	replaceDiscardWith(newAction) {
		this.discard = newAction;
		this.properties = newAction.properties;
	}

	setIsCancelled() {
		this.isCancelled = true;
		this.discard.isCancelled = true;
		return [this, this.discard];
	}

	isIdenticalTo(other) {
		if (this.constructor !== other.constructor) return false;
		return this.discard.card.current() === other.discard.card.current();
	}
}

export class Exile extends Action {
	constructor(player, card, until) {
		super(player);
		this.card = card;
		this.until = until;
	}

	async* run() {
		const card = this.card.current();
		this.card = this.card.snapshot();
		let event = events.createCardExiledEvent(this.card, this.card.owner.exileZone);
		this.card.owner.exileZone.add(this.card.current(), this.card.owner.exileZone.cards.length);
		this.card.globalId = card.globalId;
		if (this.until !== "forever") {
			let returnTiming = new Timing(this.player.game, [new Move(this.player, this.card, this.card.zone, null)]);
			getUntilTimingList(this.player, this.until).push(returnTiming);
		}
		return event;
	}

	undo() {
		let event = events.createUndoCardsMovedEvent([
			{fromZone: this.card.current().zone, fromIndex: this.card.current().index, toZone: this.card.zone, toIndex: this.card.index}
		]);
		this.card.restore();
		return event;
	}

	isImpossible() {
		if (this.card.zone?.type === "partner") {
			return true;
		}
		return false;
	}

	isIdenticalTo(other) {
		if (this.constructor !== other.constructor) return false;
		return this.card.current() === other.card.current();
	}
}

export class ApplyStatChange extends Action {
	constructor(player, toObject, modifier, until) {
		super(player);
		this.toObject = toObject;
		this.modifier = modifier;
		this.until = until;
	}

	async* run() {
		// remove invalid modifications
		ast.setImplicit([this.modifier.card], "card");
		for (let i = this.modifier.modifications.length - 1; i >= 0; i--) {
			if (!this.modifier.modifications[i].canApplyTo(this.toObject, this.modifier.ctx)) {
				this.modifier.modifications.splice(i, 1);
			}
		}
		ast.clearImplicit("card");

		if (this.toObject instanceof BaseCard) {
			this.toObject = this.toObject.snapshot();
		}
		getObjectCurrent(this.toObject).values.modifierStack.push(this.modifier);
		if (this.until !== "forever") {
			let removalTiming = new Timing(this.player.game, [new RemoveStatChange(this.player, getObjectCurrent(this.toObject), this.modifier)]);
			getUntilTimingList(this.player, this.until).push(removalTiming);
		}
	}

	undo() {
		this.toObject.current().values.modifierStack.pop();
	}

	isImpossible() {
		// players are always around and anything that wants to apply to them can
		if (this.toObject instanceof Player) return false;

		// cannot apply stat-changes to cards that are not on the field
		if (!(this.toObject.zone instanceof zones.FieldZone)) {
			return true;
		}
		// check un-appliable stat-changes
		let validModifications = 0;
		ast.setImplicit([this.modifier.card], "card");
		for (const modification of this.modifier.modifications) {
			if (!modification.canApplyTo(this.toObject, this.modifier.ctx)) {
				continue;
			}
			validModifications++;
		}
		ast.clearImplicit("card");
		return validModifications === 0;
	}
	isFullyPossible() {
		// players are always around and anything that wants to apply to them can
		if (this.toObject instanceof Player) return true;

		// cannot apply stat-changes to cards that are not on the field
		if (!(this.toObject.zone instanceof zones.FieldZone)) {
			return false;
		}
		// check not fully-appliable stat-changes
		ast.setImplicit([this.modifier.card], "card");
		for (const modification of this.modifier.modifications) {
			if (!modification.canFullyApplyTo(this.toObject, this.modifier.ctx)) {
				return false;
			}
		}
		ast.clearImplicit("card");
		return true;
	}
}

export class RemoveStatChange extends Action {
	constructor(player, object, modifier) {
		super(player);
		this.object = object;
		this.modifier = modifier;
		this._index = -1;
	}

	async* run() {
		if (this.object instanceof BaseCard) {
			this.object = this.object.snapshot();
		}
		this._index = getObjectCurrent(this.object).values.modifierStack.indexOf(this.modifier);
		getObjectCurrent(this.object).values.modifierStack.splice(this._index, 1);
	}

	undo() {
		getObjectCurrent(this.object).values.modifierStack.splice(this._index, 0, this.modifier);
	}
}

export class CancelAttack extends Action {
	constructor(player) {
		super(player);
		this.wasCancelled = null;
	}

	async* run() {
		if (this.timing.game.currentAttackDeclaration) {
			this.wasCancelled = this.timing.game.currentAttackDeclaration.isCancelled;
			this.timing.game.currentAttackDeclaration.isCancelled = true;
		}
	}

	undo() {
		if (this.timing.game.currentAttackDeclaration) {
			this.timing.game.currentAttackDeclaration.isCancelled = this.wasCancelled;
		}
	}

	isIdenticalTo(other) {
		return this.constructor === other.constructor;
	}
}

export class SetAttackTarget extends Action {
	constructor(player, newTarget) {
		super(player);
		this.newTarget = newTarget;
		this.oldTarget = null;
	}

	async* run() {
		if (this.timing.game.currentAttackDeclaration) {
			this.oldTarget = this.timing.game.currentAttackDeclaration.target;
			this.timing.game.currentAttackDeclaration.target = this.newTarget;
		}
	}

	undo() {
		if (this.timing.game.currentAttackDeclaration) {
			this.timing.game.currentAttackDeclaration.target = this.oldTarget;
		}
	}

	isImpossible() {
		return !(this.newTarget.values.current.cardTypes.includes("unit") && this.newTarget.zone instanceof zones.FieldZone);
	}

	isIdenticalTo(other) {
		if (this.constructor !== other.constructor) return false;
		return this.newTarget.current() === other.newTarget.current();
	}
}

export class GiveAttack extends Action {
	constructor(player, card) {
		super(player);
		this.card = card;
		this._oldCanAttackAgain = null;
	}

	async* run() {
		this._oldCanAttackAgain = this.card.canAttackAgain;
		this.card.canAttackAgain = true;
	}

	undo() {
		this.card.canAttackAgain = this._oldCanAttackAgain;
	}

	isImpossible() {
		if (this.card.isRemovedToken) return true;
		return !this.card.values.current.cardTypes.includes("unit");
	}

	isIdenticalTo(other) {
		if (this.constructor !== other.constructor) return false;
		return this.card.current() === other.card.current();
	}
}

export class SelectEquipableUnit extends Action {
	constructor(player, spellItem) {
		super(player);
		this.spellItem = spellItem;
		this.chosenUnit = null;
	}

	async* run() {
		let selectionRequest = new requests.chooseCards.create(this.player, this.spellItem.equipableTo.evalFull(new ScriptContext(this.spellItem, this.player))[0].get(this.player), [1], "equipTarget:" + this.spellItem.cardId);
		let response = yield [selectionRequest];
		if (response.type != "chooseCards") {
			throw new Error("Incorrect response type supplied when selecting unit to equip to. (expected \"chooseCards\", got \"" + response.type + "\" instead)");
		}
		this.chosenUnit = requests.chooseCards.validate(response.value, selectionRequest)[0];
	}

	isImpossible() {
		return this.spellItem.equipableTo.evalFull(new ScriptContext(this.spellItem, this.player))[0].get(this.player).length == 0;
	}
}

export class EquipCard extends Action {
	constructor(player, equipment, target) {
		super(player);
		this.equipment = equipment;
		this.target = target;
	}

	async* run() {
		this.equipment = this.equipment.snapshot();
		this.target = this.target.snapshot();
		let event = events.createCardEquippedEvent(this.equipment, this.target);
		this.equipment.current().equippedTo = this.target.current();
		this.target.current().equipments.push(this.equipment.current());
		return event;
	}

	undo() {
		this.target.current().equipments.pop();
		this.equipment.equippedTo = null;
	}

	isImpossible() {
		if (this.equipment.current() === null) return true;
		if (this.target.current() === null) return true;

		ast.setImplicit([this.target], "card");
		let equipTargetStillValid = this.equipment.equipableTo.evalFull(new ScriptContext(this.equipment, this.player))[0].get(this.player).includes(this.target);
		ast.clearImplicit("card");
		return !equipTargetStillValid;
	}
}

export class Shuffle extends Action {
	constructor(player) {
		super(player);
	}

	async* run() {
		await this.player.deckZone.shuffle();
		return events.createDeckShuffledEvent(this.player);
	}

	undo() {
		this.player.deckZone.undoShuffle();
	}
}

export class View extends Action {
	constructor(player, card) {
		super(player);
		this.card = card;
	}

	async* run() {
		let wasHidden = this.card.hiddenFor.includes(this.player);
		this.card.showTo(this.player);
		this.card = this.card.snapshot();
		if (wasHidden) {
			this.card.current().hideFrom(this.player);
		}
		return events.createCardViewedEvent(this.player, this.card);
	}

	isImpossible() {
		return this.card.isRemovedToken;
	}
}

export class Reveal extends Action {
	constructor(player, card) {
		super(player);
		this.card = card;
		this._oldHiddenState = null;
	}

	async* run() {
		this._oldHiddenState = this.card.current().hiddenFor;
		this.card.current().hiddenFor = [];
		this.card = this.card.snapshot();
		return events.createCardRevealedEvent(this.player, this.card);
	}

	undo() {
		this.card.current().hiddenFor = this._oldHiddenState;
	}

	isImpossible() {
		if (this.card.current() == null) return true;
		if (this.card.isRemovedToken) return true;
		return this.card.hiddenFor.length == 0;
	}

	isIdenticalTo(other) {
		if (this.constructor !== other.constructor) return false;
		return this.card.current() === other.card.current();
	}
}

export class ChangeCounters extends Action {
	constructor(player, card, type, amount) {
		super(player);
		this.card = card;
		this.type = type;
		this.amount = amount;
		this.oldAmount = null;
	}

	async* run() {
		const card = this.card.current();
		this.card = this.card.snapshot();
		if (!card.counters[this.type]) {
			card.counters[this.type] = 0;
		}
		this.oldAmount = card.counters[this.type];
		card.counters[this.type] += this.amount;
		return events.createCountersChangedEvent(this.card, this.type);
	}

	undo() {
		this.card.current().counters[this.type] = this.oldAmount;
	}

	isImpossible() {
		if (this.card.current() === null) return true;
		if (this.card.isRemovedToken) return true;
		return (this.card.counters[this.type] ?? 0) == 0 && this.amount < 0;
	}
	isFullyPossible() {
		if (this.card.current() === null) return true;
		if (this.card.isRemovedToken) return false;
		return (this.card.counters[this.type] ?? 0) + this.amount >= 0;
	}
}

export class ApplyStaticAbility extends Action {
	constructor(player, toObject, modifier) {
		super(player);
		this.toObject = toObject;
		this.modifier = modifier;
	}

	async* run() {
		if (this.toObject instanceof BaseCard) {
			this.toObject = this.toObject.snapshot();
		}
		getObjectCurrent(this.toObject).values.modifierStack.push(this.modifier);
	}

	undo() {
		getObjectCurrent(this.toObject).values.modifierStack.pop();
	}
}

export class UnapplyStaticAbility extends Action {
	constructor(player, object, ability) {
		super(player);
		this.object = object;
		this.ability = ability;

		this._modifierIndex = -1;
		this._removed = null;
	}

	async* run() {
		if (this.object instanceof BaseCard) {
			this.object = this.object.snapshot();
		}
		this._modifierIndex = getObjectCurrent(this.object).values.modifierStack.findIndex(modifier => modifier.ctx.ability === this.ability);
		this._removed = getObjectCurrent(this.object).values.modifierStack.splice(this._modifierIndex, 1)[0];
	}

	undo() {
		getObjectCurrent(this.object).values.modifierStack.splice(this._modifierIndex, 0, this._removed);
	}
}

export class SelectCards extends Action {
	constructor(player, eligibleCards, validAmounts, abilityId, validate, atRandom) {
		super(player);
		this.eligibleCards = eligibleCards;
		this.atRandom = atRandom;

		this.selectionRequest = new requests.chooseCards.create(
			player,
			eligibleCards,
			validAmounts,
			"cardEffect:" + abilityId,
			validate
		);

		this.selected = null;
	}

	async* run() {
		const wasHidden = [];
		for (const card of this.eligibleCards) {
			wasHidden.push(card.hiddenFor.includes(this.player));
			if (this.atRandom) {
				card.hideFrom(this.player);
			} else {
				card.showTo(this.player);
			}
		}
		const response = yield [this.selectionRequest];
		if (response.type != "chooseCards") {
			throw new Error("Incorrect response type supplied during card selection. (expected \"chooseCards\", got \"" + response.type + "\" instead)");
		}
		for (let i = 0; i < this.eligibleCards.length; i++) {
			if (wasHidden[i]) {
				this.eligibleCards[i].hideFrom(this.player);
			}
		}
		this.selected = requests.chooseCards.validate(response.value, this.selectionRequest).map(card => card.snapshot());
		return events.createCardsSelectedEvent(this.player, this.selected);
	}

	undo() {
		// ???
	}

	isImpossible() {
		return requests.chooseCards.generateValidResponses(this.selectionRequest).length === 0;
	}
}