import * as ast from "./cdfScriptInterpreter/astNodes.mjs";
import * as events from "./events.mjs";
import * as requests from "./inputRequests.mjs";
import * as zones from "./zones.mjs";
import {BaseCard} from "./card.mjs";
import {Player} from "./player.mjs";
import {ScriptContext, ScriptValue} from "./cdfScriptInterpreter/structs.mjs";
import {StaticAbility} from "./abilities.mjs";

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
	#costIndex = -1; // If this is non-negative, it indicates that this action is to be treated as a cost, together with other actions of the same costIndex
	constructor(player, properties = {}) {
		this.player = player;
		this.step = null; // Is set by the step itself
		this.properties = properties; // properties are accessible to cdfScript via action accessors, like retired(byPlayer: you)
		this.properties.byPlayer = new ScriptValue("player", [player]);
		this.properties.asCost = new ScriptValue("bool", [false]);
		this.isCancelled = false; // even cancelled actions stay in the game logs for abilities like that of 'Firewall Golem'
	}

	get costIndex() {
		return this.#costIndex;
	}
	set costIndex(value) {
		this.#costIndex = value;
		this.properties.asCost = new ScriptValue("bool", [value >= 0]);
	}

	// Returns the event that represents this action.
	// After run() finishes, this class should only hold references to card snapshots, not actual cards so it serves as a record of what it did
	async* run(isPrediction) {}

	undo(isPrediction) {}

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

	// returns the cards that this action is affecting (for purposes of cards being immune to things)
	get affectedObjects() {
		return [];
	}
}

export class WinGame extends Action {
	constructor(player, effectId) {
		super(player);
		this.effectId = effectId;
	}

	async* run(isPrediction) {
		this.player.victoryConditions.push("cardEffect:" + this.effectId);
	}

	undo(isPrediction) {
		this.player.victoryConditions.pop();
	}
}

export class GainMana extends Action {
	constructor(player, amount) {
		super(player);
		this.amount = amount;
	}

	async* run(isPrediction) {
		this.player.mana += this.amount;
		return events.createManaChangedEvent(this.player);
	}

	undo(isPrediction) {
		this.player.mana -= this.amount;
		return events.createManaChangedEvent(this.player);
	}

	async isImpossible() {
		return this.amount === 0;
	}
}
export class LoseMana extends Action {
	constructor(player, amount) {
		super(player);
		this.amount = amount;
	}

	async* run(isPrediction) {
		this.player.mana -= this.amount;
		return events.createManaChangedEvent(this.player);
	}

	undo(isPrediction) {
		this.player.mana += this.amount;
		return events.createManaChangedEvent(this.player);
	}

	async isImpossible() {
		return this.amount === 0 || this.player.mana === 0;
	}
	async isFullyPossible() {
		return this.amount > 0 && this.player.mana - this.amount >= 0;
	}
}

export class LoseLife extends Action {
	#oldAmount = null;
	constructor(player, amount) {
		super(player);
		this.amount = amount;
	}

	async* run(isPrediction) {
		this.#oldAmount = this.player.life;
		this.player.life = Math.max(this.player.life - this.amount, 0);
		if (this.player.life === 0) {
			this.player.next().victoryConditions.push("lifeZero");
		}
		return events.createLifeChangedEvent(this.player);
	}

	undo(isPrediction) {
		if (this.player.life === 0) {
			this.player.next().victoryConditions.pop();
		}
		this.player.life = this.#oldAmount;
		return events.createLifeChangedEvent(this.player);
	}

	async isImpossible() {
		return this.amount === 0;
	}
	async isFullyPossible() {
		return this.amount > 0 && this.player.life - this.amount >= 0;
	}
}
export class GainLife extends Action {
	constructor(player, amount) {
		super(player);
		this.amount = amount;
	}

	async* run(isPrediction) {
		this.player.life += this.amount;
		return events.createLifeChangedEvent(this.player);
	}

	undo(isPrediction) {
		this.player.life -= this.amount;
		return events.createLifeChangedEvent(this.player);
	}

	async isImpossible() {
		return this.amount === 0;
	}
}

export class Draw extends Action {
	constructor(player, amount) {
		super(player);
		this.amount = amount;
		this.drawnCards = [];
	}

	async* run(isPrediction) {
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

	undo(isPrediction) {
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

export class LiftCardOutOfCurrentZone extends Action {
	constructor(player, card) {
		super(player);
		this.card = card;
	}

	async* run(isPrediction) {
		const card = this.card.current();
		this.card = this.card.snapshot();
		card.zone?.remove(card);
		return events.createCardLiftedOutOfCurrentZoneEvent(this.player, this.card);
	}

	undo(isPrediction) {
		this.card.restore();
	}

	async isImpossible() {
		return this.card.current() === null;
	}

	isIdenticalTo(other) {
		if (this.constructor !== other.constructor) return false;
		return this.card.current() === other.card.current();
	}

	get affectedObjects() {
		return [this.card];
	}
}

// places a card on the field without moving it there yet.
export class Place extends Action {
	constructor(player, card, toZone) {
		super(player);
		this.card = card;
		// store the from zone here since, by the time this actually gets run, the card will have been lifted from that zone.
		this.fromZone = card.zone;
		this.targetZone = toZone;
		this.targetIndex = null;
	}

	async* run(isPrediction) {
		this.targetIndex = await (yield* queryZoneSlot(this.player, this.targetZone));
		const card = this.card.current();
		this.card = this.card.snapshot();
		this.targetZone.place(card, this.targetIndex);
		return events.createCardPlacedEvent(this.player, this.card, this.targetZone, this.targetIndex);
	}

	undo(isPrediction) {
		this.targetZone.placed[this.targetIndex] = null;
		this.card.restore();
		return events.createUndoCardsMovedEvent([
			{fromZone: this.targetZone, fromIndex: this.targetIndex, toZone: this.card.zone, toIndex: this.card.index}
		]);
	}

	async isImpossible() {
		if (this.card.current() === null) return true;
		return getAvailableZoneSlots(this.targetZone).length < this.step.actions.filter(action => action instanceof Place).length;
	}

	isIdenticalTo(other) {
		if (this.constructor !== other.constructor) return false;
		return this.card.current() === other.card.current();
	}

	get affectedObjects() {
		return [this.card];
	}
}

export class Summon extends Action {
	#placeAction;
	constructor(player, placeAction, reason, source) {
		const properties = {
			dueTo: reason,
			from: new ScriptValue("zone", [placeAction.fromZone]),
			to: new ScriptValue("zone", [placeAction.targetZone])
		};
		if (source) { // standard summons have no source
			properties.by = source;
		}
		super(player, properties);
		this.#placeAction = placeAction;
		this.card = placeAction.card.current();
	}

	async* run(isPrediction) {
		const card = this.card.current();
		this.card = this.card.snapshot();
		let summonEvent = events.createCardSummonedEvent(this.player, this.card, this.#placeAction.targetZone, this.#placeAction.targetIndex);
		this.#placeAction.targetZone.add(card, this.#placeAction.targetIndex);
		this.#placeAction.card.globalId = card.globalId;
		this.card.globalId = card.globalId;
		return summonEvent;
	}

	undo(isPrediction) {
		this.zone.remove(this.card.current(), this.#placeAction.targetIndex);
	}

	async isImpossible() {
		if (this.card.current() === null) return true;
		let slotCard = this.#placeAction.targetZone.get(this.#placeAction.targetIndex);
		return slotCard != null && slotCard != this.card.current();
	}

	isIdenticalTo(other) {
		if (this.constructor !== other.constructor) return false;
		return this.card.current() === other.card.current();
	}

	get affectedObjects() {
		return [this.card];
	}
}

export class Deploy extends Action {
	constructor(player, card, zone, reason, source) {
		const properties = {
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

	async* run(isPrediction) {
		const card = this.card.current();
		this.card = card.snapshot();
		let deployEvent = events.createCardDeployedEvent(this.player, this.card, card.placedTo, card.index);
		if (card) {
			card.placedTo.add(card, card.index);
			this.card.globalId = card.globalId;
		}
		return deployEvent;
	}

	undo(isPrediction) {
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

	get affectedObjects() {
		return [this.card];
	}
}

export class Cast extends Action {
	constructor(player, card, zone, reason, source) {
		const properties = {
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

	async* run(isPrediction) {
		const card = this.card.current();
		this.card = card.snapshot();
		let castEvent = events.createCardCastEvent(this.player, this.card, card.placedTo, card.index);
		if (card) {
			card.placedTo.add(card, card.index);
			this.card.globalId = card.globalId;
		}
		return castEvent;
	}

	undo(isPrediction) {
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

	get affectedObjects() {
		return [this.card];
	}
}

export class Move extends Action {
	constructor(player, card, zone, targetIndex, reason, source) {
		const properties = {};
		if (reason) properties.dueTo = reason;
		if (source) properties.by = source;
		super(player, properties);
		this.card = card;
		this.zone = zone;
		this.targetIndex = targetIndex;
		this.insertedIndex = null;
	}

	async* run(isPrediction) {
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

	undo(isPrediction) {
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
		if (this.zone instanceof zones.FieldZone && getAvailableZoneSlots(this.zone).length < this.step.actions.filter(action => action instanceof Move).length) return false;
		return this.isPossible();
	}

	isIdenticalTo(other) {
		if (this.constructor !== other.constructor) return false;
		return this.card.current() === other.card.current();
	}

	get affectedObjects() {
		return [this.card];
	}
}

export class Swap extends Action {
	constructor(player, cardA, cardB, transferEquipments, reason, source) {
		super(player, {
			dueTo: reason,
			by: source
		});
		this.cardA = cardA;
		this.cardB = cardB;
		this.transferEquipments = transferEquipments;
	}

	async* run(isPrediction) {
		const cardA = this.cardA.current();
		const cardB = this.cardB.current();
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

	undo(isPrediction) {
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

	get affectedObjects() {
		return [this.cardA, this.cardB];
	}
}

export class EstablishAttackDeclaration extends Action {
	constructor(player, attackers) {
		super(player);
		this.attackers = attackers;
		this.attackTarget = null;
	}

	// TODO: Is this impossible if no attackers left?
	async* run(isPrediction) {
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

	async* run(isPrediction) {
		this.oldAmount = this.target.life;
		this.target.life = Math.max(this.target.life - this.amount, 0);
		if (this.target.life == 0) {
			this.target.next().victoryConditions.push("lifeZero");
		}
		return events.createDamageDealtEvent(this.target, this.amount);
	}

	undo(isPrediction) {
		if (this.target.life === 0) {
			this.target.next().victoryConditions.pop();
		}
		this.target.life = this.oldAmount;
		return events.createLifeChangedEvent(this.target);
	}

	async isImpossible() {
		return this.amount === 0;
	}
}

export class Discard extends Action {
	constructor(player, card, reason, source) {
		let properties = {
			dueTo: reason,
			from: new ScriptValue("zone", [card.zone]),
			to: new ScriptValue("zone", [card.owner.discardPile]),
			byDestroy: new ScriptValue("bool", [false])
		};
		if (source) { // source only exists if discarded by card effect
			properties.by = source;
		}
		super(player, properties);
		this.card = card;
	}

	async* run(isPrediction) {
		const card = this.card.current();
		this.card = this.card.snapshot();
		let event = events.createCardDiscardedEvent(this.card, this.card.owner.discardPile);
		this.card.owner.discardPile.add(this.card.current(), this.card.owner.discardPile.cards.length);
		this.card.globalId = card.globalId;
		return event;
	}

	undo(isPrediction) {
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

	get affectedObjects() {
		return [this.card];
	}
}

export class Destroy extends Action {
	constructor(discard) {
		super(discard.player, discard.properties);
		this.discard = discard;
		this.discard.properties.byDestroy = new ScriptValue("bool", [true]);
	}

	async* run(isPrediction) {
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

	get affectedObjects() {
		return [this.discard.card];
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

	async* run(isPrediction) {
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

	undo(isPrediction) {
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

	get affectedObjects() {
		return [this.card];
	}
}

export class ApplyStatChange extends Action {
	constructor(player, toObject, modifier, until, reason, source) {
		super(player, {
			dueTo: reason,
			by: source
		});
		this.toObject = toObject;
		this.modifier = modifier;
		this.until = until; // the array that the un-apply action goes into (or null, if it is permanent)
	}

	async* run(isPrediction) {
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
		this.player.game.registerPendingValueChangeFor(currentObject);
		if (this.until) {
			this.until.push([new RemoveStatChange(this.player, currentObject, this.modifier)]);
		}
	}

	undo(isPrediction) {
		const currentObject = getObjectCurrent(this.toObject);
		currentObject.values.modifierStack.pop();
		this.player.game.registerPendingValueChangeFor(currentObject);
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

	get affectedObjects() {
		return [this.toObject];
	}
}
export class RemoveStatChange extends Action {
	#index = -1;
	constructor(player, object, modifier) {
		super(player);
		this.object = object;
		this.modifier = modifier;
	}

	async* run(isPrediction) {
		const currentObject = getObjectCurrent(this.object);
		if (this.object instanceof BaseCard) {
			this.object = this.object.snapshot();
		}
		this.#index = currentObject.values.modifierStack.indexOf(this.modifier);
		currentObject.values.modifierStack.splice(this.#index, 1);
		this.player.game.registerPendingValueChangeFor(currentObject);
	}

	undo(isPrediction) {
		const currentObject = getObjectCurrent(this.object);
		currentObject.values.modifierStack.splice(this.#index, 0, this.modifier);
		this.player.game.registerPendingValueChangeFor(currentObject);
	}

	// no objects are affected since objects cannot be immune to a stat change expiring
}

export class CancelAttack extends Action {
	constructor(player, reason, source) {
		super(player, {
			dueTo: reason,
			by: source
		});
		this.wasCancelled = null;
	}

	async* run(isPrediction) {
		if (this.player.game.currentAttackDeclaration) {
			this.wasCancelled = this.player.game.currentAttackDeclaration.isCancelled;
			this.player.game.currentAttackDeclaration.isCancelled = true;
		}
	}

	undo(isPrediction) {
		if (this.player.game.currentAttackDeclaration) {
			this.player.game.currentAttackDeclaration.isCancelled = this.wasCancelled;
		}
	}

	isIdenticalTo(other) {
		return this.constructor === other.constructor;
	}

	get affectedObjects() {
		const mainAttacker = this.player.game.currentAttackDeclaration?.mainCard;
		if (mainAttacker) {
			return [mainAttacker];
		}
		return [];
	}
}

export class SetAttackTarget extends Action {
	#oldTarget = null;
	constructor(player, newTarget, reason, source) {
		super(player, {
			dueTo: reason,
			by: source
		});
		this.newTarget = newTarget;
	}

	async* run(isPrediction) {
		this.newTarget = this.newTarget.snapshot();
		if (this.step.game.currentAttackDeclaration) {
			this.#oldTarget = this.step.game.currentAttackDeclaration.target;
			this.step.game.currentAttackDeclaration.target = this.newTarget.current();
			if (this.#oldTarget) {
				this.#oldTarget.isAttackTarget = false;
			}
			this.newTarget.current().isAttackTarget = true;
		}
	}

	undo(isPrediction) {
		if (this.step.game.currentAttackDeclaration) {
			this.step.game.currentAttackDeclaration.target = this.#oldTarget;
			this.newTarget.current().isAttackTarget = false;
			if (this.#oldTarget) {
				this.#oldTarget.isAttackTarget = true;
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

	get affectedObjects() {
		const mainAttacker = this.player.game.currentAttackDeclaration?.mainCard;
		if (mainAttacker) {
			return [mainAttacker];
		}
		return [];
	}
}

export class GiveAttack extends Action {
	#oldCanAttackAgain = null;
	constructor(player, card, reason, source) {
		super(player, {
			dueTo: reason,
			by: source
		});
		this.card = card;
	}

	async* run(isPrediction) {
		this.#oldCanAttackAgain = this.card.canAttackAgain;
		this.card.canAttackAgain = true;
	}

	undo(isPrediction) {
		this.card.canAttackAgain = this.#oldCanAttackAgain;
	}

	async isImpossible() {
		if (!this.card) return true;
		if (this.card.isRemovedToken) return true;
		return !this.card.values.current.cardTypes.includes("unit");
	}

	isIdenticalTo(other) {
		if (this.constructor !== other.constructor) return false;
		return this.card.current() === other.card.current();
	}

	get affectedObjects() {
		if (!this.card) return [];
		return [this.card];
	}
}

export class SelectEquipableUnit extends Action {
	#oldEquipTarget = null;
	constructor(player, spellItem) {
		super(player);
		this.spellItem = spellItem;
	}

	async* run(isPrediction) {
		let selectionRequest = new requests.ChooseCards(this.player, this.spellItem.equipableTo.evalFull(new ScriptContext(this.spellItem, this.player)).next().value.get(this.player), [1], "equipTarget:" + this.spellItem.cardId);
		let response = yield [selectionRequest];
		// If there is no current block (during castability checking), we write nothing.
		// This does not matter since the target availability checker doesn't validate targets for the equip action.
		const currentBlock = this.player.game.currentBlock();
		if (currentBlock) {
			this.#oldEquipTarget = currentBlock.equipTarget;
			currentBlock.equipTarget = (await selectionRequest.extractResponseValue(response))[0];
		}
	}

	undo(isPrediction) {
		const currentBlock = this.player.game.currentBlock();
		if (currentBlock) {
			currentBlock.equipTarget = this.#oldEquipTarget;
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

	async* run(isPrediction) {
		this.equipment = this.equipment.snapshot();
		this.target = this.target.snapshot();
		const event = events.createCardEquippedEvent(this.equipment, this.target);
		this.equipment.current().equippedTo = this.target.current();
		this.target.current().equipments.push(this.equipment.current());
		return event;
	}

	undo(isPrediction) {
		this.target.current().equipments.pop();
		this.equipment.equippedTo = null;
	}

	async isImpossible() {
		if (this.equipment.current() === null) return true;
		if (this.target.current() === null) return true;

		ast.setImplicit([this.target], "card");
		const equipTargetStillValid = this.equipment.equipableTo.evalFull(new ScriptContext(this.equipment, this.player)).next().value.get(this.player).includes(this.target);
		ast.clearImplicit("card");
		return !equipTargetStillValid;
	}

	// no objects are affected since this is not a thing that cards can be immune to
}

export class Shuffle extends Action {
	constructor(player) {
		super(player);
	}

	async* run(isPrediction) {
		// during predictions, anything that needs randomness must be avoided since randomness can require cooperation by the opponent
		if (isPrediction) return;
		await this.player.deckZone.shuffle();
		return events.createDeckShuffledEvent(this.player);
	}

	undo(isPrediction) {
		if (isPrediction) return;
		this.player.deckZone.undoShuffle();
	}
}

export class RollDice extends Action {
	constructor(player, sidedness) {
		this.sidedness = sidedness;
		this.result = null;
	}

	async* run(isPrediction) {
		if (!isPrediction) {
			this.result = await this.player.game.randomInt(this.sidedness) + 1;
		} else {
			// during predictions, anything that needs randomness must be avoided since randomness can require cooperation by the opponent, so we just pretend it's 1.
			// TODO: Currently, there are no dice rolls in predicted sections. If they come up this probably needs to be revisited and all results must create option tree branches.
			this.result = 1;
		}
		return events.createDiceRolledEvent(this.player, this.sidedness, this.result);
	}

	undo(isPrediction) {
		if (!isPrediction) {
			this.player.game.undoRandom();
		}
		this.result = null;
	}
}

export class View extends Action {
	constructor(player, card) {
		super(player);
		this.card = card;
	}

	async* run(isPrediction) {
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

	get affectedObjects() {
		return [this.card];
	}
}

export class Reveal extends Action {
	constructor(player, card, until = false) {
		super(player);
		this.card = card;
		this.until = until; // the array that the un-reveal action goes into (null, if permanent, false if momentarily)
	}

	async* run(isPrediction) {
		this.card.current().hiddenFor = [];
		this.card = this.card.current().snapshot();
		switch (this.until) {
			case false: { // Hide away immediately
				this.card.current().hiddenFor = this.card.current().zone.defaultHiddenFor;
				break;
			}
			case null: { // just keep revealed ( = do nothing right now )
				break;
			}
			default: { // until some specified time
				this.until.push([new Unreveal(this.player, this.card.current())]);
			}
		}
		return events.createCardRevealedEvent(this.player, this.card, this.until === false);
	}

	undo(isPrediction) {
		this.card.current().hiddenFor = this.card.current().zone.defaultHiddenFor;
	}

	async isImpossible() {
		if (this.card.current() === null) return true;
		if (this.card.isRemovedToken) return true;
		return this.card.hiddenFor.length === 0;
	}

	isIdenticalTo(other) {
		if (this.constructor !== other.constructor) return false;
		return this.card.current() === other.card.current();
	}

	get affectedObjects() {
		return [this.card];
	}
}
export class Unreveal extends Action {
	#oldHiddenState = null;
	constructor(player, card) {
		super(player);
		this.card = card;
	}

	async* run(isPrediction) {
		this.#oldHiddenState = this.card.current().hiddenFor;
		this.card = this.card.snapshot();
		this.card.current().hiddenFor = this.card.current().zone.defaultHiddenFor;
		return events.createCardUnrevealedEvent(this.card.current().hiddenFor, this.card);
	}

	undo(isPrediction) {
		this.card.current().hiddenFor = this.#oldHiddenState;
	}

	async isImpossible() {
		const currentCard = this.card.current();
		if (currentCard === null) return true;
		if (currentCard.isRemovedToken) return true;
		// is the card already hidden from the right people?
		return currentCard.zone.defaultHiddenFor.filter(player => !currentCard.hiddenFor.includes(player)).length === 0;
	}

	isIdenticalTo(other) {
		if (this.constructor !== other.constructor) return false;
		return this.card.current() === other.card.current();
	}

	// no objects are affected since cards cannot be immune to a stat change expiring
	// TODO: clarify if this actually applies to unrevealing cards
}

export class ChangeCounters extends Action {
	#oldAmount = null;
	constructor(player, card, type, amount, reason, source) {
		super(player, {
			dueTo: reason,
			by: source
		});
		this.card = card;
		this.type = type;
		this.amount = amount;
	}

	async* run(isPrediction) {
		const card = this.card.current();
		this.card = this.card.snapshot();
		if (!card.counters[this.type]) {
			card.counters[this.type] = 0;
		}
		this.#oldAmount = card.counters[this.type];
		card.counters[this.type] += this.amount;
		return events.createCountersChangedEvent(this.card, this.type);
	}

	undo(isPrediction) {
		this.card.current().counters[this.type] = this.#oldAmount;
	}

	async isImpossible() {
		if (this.amount === 0) return true;
		if (this.card.current() === null) return true;
		if (this.card.isRemovedToken) return true;
		return (this.card.counters[this.type] ?? 0) == 0 && this.amount < 0;
	}
	async isFullyPossible() {
		if (this.isImpossible()) return false;
		return (this.card.counters[this.type] ?? 0) + this.amount >= 0;
	}

	get affectedObjects() {
		return [this.card];
	}
}

export class ApplyStaticAbility extends Action {
	#hadStaticAbilityBefore = null;
	constructor(player, toObject, modifier) {
		super(player);
		this.toObject = toObject;
		this.modifier = modifier;
	}

	async* run(isPrediction) {
		const currentObject = getObjectCurrent(this.toObject);
		if (this.toObject instanceof BaseCard) {
			this.toObject = this.toObject.snapshot();
		}
		currentObject.values.modifierStack.push(this.modifier);
		this.#hadStaticAbilityBefore = currentObject.values.modifiedByStaticAbility;
		currentObject.values.modifiedByStaticAbility = true;
		this.player.game.registerPendingValueChangeFor(currentObject);
	}

	undo(isPrediction) {
		const currentObject = getObjectCurrent(this.toObject);
		currentObject.values.modifierStack.pop();
		currentObject.values.modifiedByStaticAbility = this.#hadStaticAbilityBefore;
		this.player.game.registerPendingValueChangeFor(currentObject);
	}

	// doesn't affect any objects since the unaffection from static abilities has special handling.
}
export class UnapplyStaticAbility extends Action {
	#modifierIndex = -1;
	#removed = null;
	constructor(player, object, ability) {
		super(player);
		this.object = object;
		this.ability = ability;
	}

	async* run(isPrediction) {
		const currentObject = getObjectCurrent(this.object);
		if (this.object instanceof BaseCard) {
			this.object = this.object.snapshot();
		}
		this.#modifierIndex = currentObject.values.modifierStack.findIndex(modifier => modifier.ctx.ability === this.ability);
		this.#removed = currentObject.values.modifierStack.splice(this.#modifierIndex, 1)[0];
		currentObject.values.modifiedByStaticAbility = currentObject.values.modifierStack.some(modifier => modifier.ctx.ability instanceof StaticAbility);
		this.player.game.registerPendingValueChangeFor(currentObject);
	}

	undo(isPrediction) {
		const currentObject = getObjectCurrent(this.object);
		currentObject.values.modifierStack.splice(this.#modifierIndex, 0, this.#removed);
		currentObject.values.modifiedByStaticAbility = true;
		this.player.game.registerPendingValueChangeFor(currentObject);
	}

	// doesn't affect any objects since the unaffection from static abilities has special handling.
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

	async* run(isPrediction) {
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
			} else {
				this.eligibleCards[i].showTo(this.player);
			}
		}
		for (const card of this.selected) {
			this.ctxTargetList.push(card);
		}

		return events.createCardsSelectedEvent(this.player, this.selected);
	}

	undo(isPrediction) {
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

	async* run(isPrediction) {
		const response = yield [this.selectionRequest];
		this.selected = (await this.selectionRequest.extractResponseValue(response));
		this.ctxTargetList.push(this.selected);

		return events.createAbilitySelectedEvent(this.player, this.selected);
	}

	undo(isPrediction) {
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

	async* run(isPrediction) {
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

	async* run(isPrediction) {
		const response = yield [this.selectionRequest];
		this.selected = (await this.selectionRequest.extractResponseValue(response));
		this.ctxTargetList.push(this.selected);

		return events.createPlayerSelectedEvent(this.player, this.selected);
	}

	undo(isPrediction) {
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

	async* run(isPrediction) {
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

	async* run(isPrediction) {
		const response = yield [this.orderRequest];
		this.ordered = (await this.orderRequest.extractResponseValue(response)).map(card => card.snapshot());

		return events.createCardsOrderedEvent(this.player, this.ordered);
	}

	async isImpossible() {
		const responses = this.orderRequest.generateValidResponses();
		return (await responses.next()).done;
	}
}