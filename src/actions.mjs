import * as ast from "./cdfScriptInterpreter/astNodes.mjs";
import * as events from "./events.mjs";
import * as requests from "./inputRequests.mjs";
import * as zones from "./zones.mjs";
import {BaseCard} from "./card.mjs";
import {Player} from "./player.mjs";
import {ScriptContext, ScriptValue} from "./cdfScriptInterpreter/structs.mjs";

// helper functions

// exported helper functions
export function replaceActionInList(list, action, replacements) {
	// replacing a destroy also replaces the corresponding discard
	if (action instanceof Destroy) {
		list.splice(list.indexOf(action.discard), 1);
	}
	// replacing a destroy's internal discard needs to update the destroy.
	for (const destroy of list) {
		if (destroy instanceof Destroy && destroy.discard === action) {
			// TODO: figure out if a destroy's discard action can ever be replaced by multiple things
			destroy.replaceDiscardWith(replacements[0]);
		}
	}
	// actually replace the action
	list.splice(list.indexOf(action), 1, ...replacements);
	for (const replacement of replacements) {
		replacement.costIndex = action.costIndex;
	}
}

// internal helper functions
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
async function* queryZoneSlot(player, zone) {
	let zoneSlotRequest = new requests.ChooseZoneSlot(player, zone, getAvailableZoneSlots(zone));
	let zoneSlotResponse = yield [zoneSlotRequest];
	return await zoneSlotRequest.extractResponseValue(zoneSlotResponse);
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
		this.properties = properties; // properties are accessible to cdfScript via action accessors, like retired(byPlayer: you)
		this.properties.byPlayer = new ScriptValue("player", [player]);
		this.isCancelled = false; // even cancelled timings stay in the game logs for abilities like that of 'Firewall Golem'
	}

	// Returns the event that represents this action.
	// After run() finishes, this class should only hold references to card snapshots, not actual cards so it serves as a record of what it did
	async* run() {}

	undo() {}

	async isImpossible() {
		return false;
	}
	async isPossible() {
		return !(await this.isImpossible());
	}
	async isFullyPossible() {
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

export class GainMana extends Action {
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
}
export class LoseMana extends Action {
	constructor(player, amount) {
		super(player);
		this.amount = amount;
	}

	async* run() {
		this.player.mana -= this.amount;
		return events.createManaChangedEvent(this.player);
	}

	undo() {
		this.player.mana += this.amount;
		return events.createManaChangedEvent(this.player);
	}

	async isImpossible() {
		return this.player.mana === 0 && this.amount > 0;
	}
	async isFullyPossible() {
		return this.player.mana - this.amount >= 0;
	}
}

export class LoseLife extends Action {
	constructor(player, amount) {
		super(player);
		this.amount = amount;
		this._oldAmount = null;
	}

	async* run() {
		this._oldAmount = this.player.life;
		this.player.life = Math.max(this.player.life - this.amount, 0);
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

	async isFullyPossible() {
		return this.player.life - this.amount >= 0;
	}
}
export class GainLife extends Action {
	constructor(player, amount) {
		super(player);
		this.amount = amount;
	}

	async* run() {
		this.player.life += this.amount;
		return events.createLifeChangedEvent(this.player);
	}

	undo() {
		this.player.life -= this.amount;
		return events.createLifeChangedEvent(this.player);
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
			let drawnCard = this.player.deckZone.cards.at(-1);
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
		this.targetIndex = await (yield* queryZoneSlot(this.player, this.zone));
		const card = this.card.current();
		this.card = this.card.snapshot();
		card.hiddenFor = [];
		this.zone.place(card, this.targetIndex);
		return events.createCardPlacedEvent(this.player, this.card, this.zone, this.targetIndex);
	}

	undo() {
		this.zone.placed[this.targetIndex] = null;
		this.card.restore();
		return events.createUndoCardsMovedEvent([
			{fromZone: this.zone, fromIndex: this.targetIndex, toZone: this.card.zone, toIndex: this.card.index}
		]);
	}

	async isImpossible() {
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
		let properties = {
			dueTo: reason,
			from: new ScriptValue("zone", [placeAction.card.zone]),
			to: new ScriptValue("zone", [placeAction.zone])
		};
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

	async isImpossible() {
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
	constructor(player, card, zone, reason, source) {
		let properties = {
			dueTo: reason,
			from: new ScriptValue("zone", [card.zone]),
			to: new ScriptValue("zone", [zone])
		};
		if (source) { // only exists if deployed by card effect
			properties.by = source;
		}
		super(player, properties);
		this.card = card;
	}

	async* run() {
		const card = this.card.current();
		this.card = card.snapshot();
		let deployEvent = events.createCardDeployedEvent(this.player, this.card, card.placedTo, card.index);
		if (card) {
			card.placedTo.add(card, card.index);
			this.card.globalId = card.globalId;
		}
		return deployEvent;
	}

	undo() {
		const card = this.card.current();
		card.zone.remove(card);
	}

	async isImpossible() {
		return this.card.current() === null;
	}

	isIdenticalTo(other) {
		if (this.constructor !== other.constructor) return false;
		return this.card.current() === other.card.current();
	}
}

export class Cast extends Action {
	constructor(player, card, zone, reason, source) {
		let properties = {
			dueTo: reason,
			from: new ScriptValue("zone", [card.zone]),
			to: new ScriptValue("zone", [zone])
		};
		if (source) { // only exists if cast by card effect
			properties.by = source;
		}
		super(player, properties);
		this.card = card;
	}

	async* run() {
		const card = this.card.current();
		this.card = card.snapshot();
		let castEvent = events.createCardCastEvent(this.player, this.card, card.placedTo, card.index);
		if (card) {
			card.placedTo.add(card, card.index);
			this.card.globalId = card.globalId;
		}
		return castEvent;
	}

	undo() {
		const card = this.card.current();
		card.zone.remove(card);
	}

	async isImpossible() {
		return this.card.current() === null;
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
				this.insertedIndex = await (yield* queryZoneSlot(this.player, this.zone));
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

	async isImpossible() {
		if (!this.card.current()) return true;
		if (this.card.current().isRemovedToken) return true;
		if (this.card.current().zone?.type == "partner") return true;
		if (this.zone instanceof zones.FieldZone && getAvailableZoneSlots(this.zone).length === 0) return true;
		return false;
	}
	async isFullyPossible() {
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

	async isImpossible() {
		if (this.cardA.current() === null) return true;
		if (this.cardB.current() === null) return true;
		if ((this.cardA.isToken && !(this.cardB.zone instanceof zones.FieldZone)) ||
			(this.cardB.isToken && !(this.cardA.zone instanceof zones.FieldZone)) ||
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
		let targetSelectRequest = new requests.ChooseCards(this.player, eligibleUnits, [1], "selectAttackTarget");
		let response = yield [targetSelectRequest];
		this.attackTarget = (await targetSelectRequest.extractResponseValue(response))[0];

		// handle remaining attack rights
		this.attackers = this.attackers.map(attacker => attacker.snapshot());
		this.attackTarget = this.attackTarget.snapshot();

		return events.createAttackDeclarationEstablishedEvent(this.player, this.attackTarget, this.attackers);
	}
}

export class DealDamage extends Action {
	constructor(player, target, amount, reason, source) {
		super(player, {
			to: new ScriptValue("player", target),
			dueTo: reason,
			by: source
		});
		this.target = target;
		this.amount = amount;
		this.oldAmount = null;
	}

	async* run() {
		this.oldAmount = this.target.life;
		this.target.life = Math.max(this.target.life - this.amount, 0);
		if (this.target.life == 0) {
			this.target.next().victoryConditions.push("lifeZero");
		}
		return events.createDamageDealtEvent(this.target, this.amount);
	}

	undo() {
		if (this.target.life === 0) {
			this.target.next().victoryConditions.pop();
		}
		this.target.life = this.oldAmount;
		return events.createLifeChangedEvent(this.target);
	}
}

export class Discard extends Action {
	constructor(player, card, reason, source) {
		let properties = {
			dueTo: reason,
			from: new ScriptValue("zone", [card.zone]),
			to: new ScriptValue("zone", [card.owner.discardPile])
		};
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

	async isImpossible() {
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

	async isImpossible() {
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
	constructor(player, card, until, reason, source) {
		let properties = {
			dueTo: reason,
			from: new ScriptValue("zone", [card.zone]),
			to: new ScriptValue("zone", [card.owner.exileZone])
		};
		if (source) { // source only exists if exiled by card effect
			properties.by = source;
		}
		super(player, properties);
		this.card = card;
		this.until = until; // the array that the 'undo' action goes into (to exile until some time)
	}

	async* run() {
		const card = this.card.current();
		this.card = this.card.snapshot();
		let event = events.createCardExiledEvent(this.card, this.card.owner.exileZone);
		this.card.owner.exileZone.add(this.card.current(), this.card.owner.exileZone.cards.length);
		this.card.globalId = card.globalId;
		if (this.until) {
			this.until.push([new Move(this.player, this.card.current(), this.card.zone, null)]);
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

	async isImpossible() {
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
		this.until = until; // the array that the un-apply action goes into (or null, if it is permanent)
	}

	async* run() {
		const currentObject = getObjectCurrent(this.toObject);
		// remove invalid modifications
		ast.setImplicit([this.modifier.card], "card");
		for (let i = this.modifier.modifications.length - 1; i >= 0; i--) {
			if (!this.modifier.modifications[i].canApplyTo(currentObject, this.modifier.ctx)) {
				this.modifier.modifications.splice(i, 1);
			}
		}
		ast.clearImplicit("card");

		if (currentObject instanceof BaseCard) {
			this.toObject = currentObject.snapshot();
		}
		currentObject.values.modifierStack.push(this.modifier);
		if (this.until) {
			this.until.push([new RemoveStatChange(this.player, currentObject, this.modifier)]);
		}
	}

	undo() {
		getObjectCurrent(this.toObject).values.modifierStack.pop();
	}

	async isImpossible() {
		// players are always around and anything that wants to apply to them can
		if (this.toObject instanceof Player) return false;

		const currentObject = getObjectCurrent(this.toObject);
		// cannot apply stat changes things that don't exist anymore
		if (!currentObject) {
			return true;
		}

		// cannot apply stat changes to cards that are not on the field
		if (currentObject instanceof BaseCard && !(currentObject.zone instanceof zones.FieldZone)) {
			return true;
		}

		// check un-appliable stat-changes
		let validModifications = 0;
		ast.setImplicit([this.modifier.card], "card");
		for (const modification of this.modifier.modifications) {
			if (!modification.canApplyTo(currentObject, this.modifier.ctx)) {
				continue;
			}
			validModifications++;
		}
		ast.clearImplicit("card");
		return validModifications === 0;
	}
	async isFullyPossible() {
		// players are always around and anything that wants to apply to them can
		if (this.toObject instanceof Player) return true;

		const currentObject = getObjectCurrent(this.toObject);
		// cannot apply stat changes things that don't exist anymore
		if (!currentObject) {
			return false;
		}

		// cannot apply stat changes to cards that are not on the field
		if (currentObject instanceof BaseCard && !(currentObject.zone instanceof zones.FieldZone)) {
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
		this._oldTarget = null;
	}

	async* run() {
		this.newTarget = this.newTarget.snapshot();
		if (this.timing.game.currentAttackDeclaration) {
			this._oldTarget = this.timing.game.currentAttackDeclaration.target;
			this.timing.game.currentAttackDeclaration.target = this.newTarget.current();
			if (this._oldTarget) {
				this._oldTarget.isAttackTarget = false;
			}
			this.newTarget.current().isAttackTarget = true;
		}
	}

	undo() {
		if (this.timing.game.currentAttackDeclaration) {
			this.timing.game.currentAttackDeclaration.target = this._oldTarget;
			this.newTarget.current().isAttackTarget = false;
			if (this._oldTarget) {
				this._oldTarget.isAttackTarget = true;
			}
		}
	}

	async isImpossible() {
		if (this.newTarget === null) return true;
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

	async isImpossible() {
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
		this._oldEquipTarget = null;
	}

	async* run() {
		let selectionRequest = new requests.ChooseCards(this.player, this.spellItem.equipableTo.evalFull(new ScriptContext(this.spellItem, this.player)).next().value.get(this.player), [1], "equipTarget:" + this.spellItem.cardId);
		let response = yield [selectionRequest];
		// If there is no current block (during castability checking), we write nothing.
		// This does not matter since the target availability checker doesn't validate targets for the equip action.
		const currentBlock = this.player.game.currentBlock();
		if (currentBlock) {
			this._oldEquipTarget = currentBlock.equipTarget;
			currentBlock.equipTarget = (await selectionRequest.extractResponseValue(response))[0];
		}
	}

	undo() {
		const currentBlock = this.player.game.currentBlock();
		if (currentBlock) {
			currentBlock.equipTarget = this._oldEquipTarget;
		}
	}

	async isImpossible() {
		return this.spellItem.equipableTo.evalFull(new ScriptContext(this.spellItem, this.player)).next().value.get(this.player).length == 0;
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

	async isImpossible() {
		if (this.equipment.current() === null) return true;
		if (this.target.current() === null) return true;

		ast.setImplicit([this.target], "card");
		let equipTargetStillValid = this.equipment.equipableTo.evalFull(new ScriptContext(this.equipment, this.player)).next().value.get(this.player).includes(this.target);
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

export class RollDice extends Action {
	constructor(player, sidedness) {
		this.sidedness = sidedness;
		this.result = null;
	}

	async* run() {
		this.result = await this.player.game.randomInt(this.sidedness) + 1;
		return events.createDiceRolledEvent(this.player, this.sidedness, this.result);
	}

	undo() {
		this.result = null;
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

	async isImpossible() {
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

	async isImpossible() {
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

	async isImpossible() {
		if (this.card.current() === null) return true;
		if (this.card.isRemovedToken) return true;
		return (this.card.counters[this.type] ?? 0) == 0 && this.amount < 0;
	}
	async isFullyPossible() {
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
	constructor(player, eligibleCards, validAmounts, abilityId, validatorFunction, atRandom, ctxTargetList) {
		super(player);
		this.eligibleCards = eligibleCards;
		this.atRandom = atRandom;
		this.ctxTargetList = ctxTargetList; // the targets of the current ability context that need to be modified by this choice

		this.selectionRequest = new requests.ChooseCards(
			player,
			eligibleCards,
			validAmounts,
			"cardEffect:" + abilityId,
			validatorFunction
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
		this.selected = (await this.selectionRequest.extractResponseValue(response)).map(card => card.snapshot());
		for (let i = 0; i < this.eligibleCards.length; i++) {
			if (wasHidden[i]) {
				this.eligibleCards[i].hideFrom(this.player);
			}
		}
		for (const card of this.selected) {
			this.ctxTargetList.push(card);
		}

		return events.createCardsSelectedEvent(this.player, this.selected);
	}

	undo() {
		this.ctxTargetList.splice(-this.selected.length, this.selected.length);
	}

	async isImpossible() {
		const responses = this.selectionRequest.generateValidResponses();
		return (await responses.next()).done;
	}
}

export class SelectAbility extends Action {
	constructor(player, eligibleAbilities, abilityId, ctxTargetList) {
		super(player);
		this.ctxTargetList = ctxTargetList; // the targets of the current ability context that need to be modified by this choice

		this.selectionRequest = new requests.ChooseAbility(
			player,
			abilityId,
			eligibleAbilities
		);

		this.selected = null;
	}

	async* run() {
		const response = yield [this.selectionRequest];
		this.selected = (await this.selectionRequest.extractResponseValue(response));
		this.ctxTargetList.push(this.selected);

		return events.createAbilitySelectedEvent(this.player, this.selected);
	}

	undo() {
		this.ctxTargetList.pop();
	}

	async isImpossible() {
		const responses = this.selectionRequest.generateValidResponses();
		return (await responses.next()).done;
	}
}

export class SelectDeckSide extends Action {
	constructor(player, deckOwner, abilityId) {
		super(player);

		this.selectionRequest = new requests.ChooseDeckSide(
			player,
			abilityId,
			deckOwner
		);

		this.selected = null;
	}

	async* run() {
		const response = yield [this.selectionRequest];
		this.selected = await this.selectionRequest.extractResponseValue(response);

		return events.createDeckSideSelectedEvent(this.player, this.selected.isTop? "top" : "bottom");
	}

	async isImpossible() {
		const responses = this.selectionRequest.generateValidResponses();
		return (await responses.next()).done;
	}
}

export class SelectPlayer extends Action {
	constructor(player, abilityId, ctxTargetList) {
		super(player);
		this.ctxTargetList = ctxTargetList; // the targets of the current ability context that need to be modified by this choice

		this.selectionRequest = new requests.ChoosePlayer(player, "cardEffect:" + abilityId);

		this.selected = null;
	}

	async* run() {
		const response = yield [this.selectionRequest];
		this.selected = (await this.selectionRequest.extractResponseValue(response));
		this.ctxTargetList.push(this.selected);

		return events.createPlayerSelectedEvent(this.player, this.selected);
	}

	undo() {
		this.ctxTargetList.pop();
	}

	async isImpossible() {
		const responses = this.selectionRequest.generateValidResponses();
		return (await responses.next()).done;
	}
}

export class SelectType extends Action {
	constructor(player, eligibleTypes, abilityId) {
		super(player);

		this.selectionRequest = new requests.ChooseType(
			player,
			abilityId,
			eligibleTypes
		);

		this.selected = null;
	}

	async* run() {
		const response = yield [this.selectionRequest];
		this.selected = (await this.selectionRequest.extractResponseValue(response));

		return events.createTypeSelectedEvent(this.player, this.selected);
	}

	async isImpossible() {
		const responses = this.selectionRequest.generateValidResponses();
		return (await responses.next()).done;
	}
}

export class OrderCards extends Action {
	constructor(player, toOrder, abilityId) {
		super(player);

		this.orderRequest = new requests.OrderCards(
			player,
			toOrder,
			"cardEffect:" + abilityId
		);

		this.ordered = null;
	}

	async* run() {
		const response = yield [this.orderRequest];
		this.ordered = (await this.orderRequest.extractResponseValue(response)).map(card => card.snapshot());

		return events.createCardsOrderedEvent(this.player, this.ordered);
	}

	async isImpossible() {
		const responses = this.orderRequest.generateValidResponses();
		return (await responses.next()).done;
	}
}