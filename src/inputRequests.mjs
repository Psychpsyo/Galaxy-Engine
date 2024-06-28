// This file input request definitions for passing out of the engine
import {DeckPosition} from "./cdfScriptInterpreter/structs.mjs";
import {nChooseK} from "./math.mjs";

export class InputRequest {
	constructor(player, type) {
		this.player = player;
		this.type = type;
		// If this choice is in an option tree, we need to validate every response against the tree.
		// For example during cost payment, choices that lead to invalid payment cannot be taken.
		this.optionTreeNode = null;
	}

	// converts the data in a response value to actual objects and stuff.
	// a common use-case is converting from card indices to actual card objects
	async extractResponseValue(response) {
		const errorCode = await this.validate(response);
		if (errorCode !== "") throw new Error("Supplied invalid response: " + errorCode);
		return response.value;
	}

	// checks if a given response is valid an legal and returns empty string if it is, or a reason as to why if it isn't
	// Only call this if the game state is at the point where the response is expected!
	async validate(response) {
		if (response.type != this.type) {
			return `Incorrect response type supplied. (expected "${this.type}", got "${response.type}" instead)`;
		}
		if (this.optionTreeNode) {
			return (await this.optionTreeNode.isValidChoice(response))? "" : "Invalid choice due to option tree.";
		}
		return "";
	}

	// filters all possible responses based on if this request's optionTreeNode is restricting it
	// Only call this if the game state is at the point where the responses are expected!
	async *generateValidResponses() {
		for (const response of this.generateResponses()) {
			if (!this.optionTreeNode || await this.optionTreeNode.isValidChoice({type: this.type, value: response})) {
				yield response;
			}
		}
	}

	// To be overriden in subclasses & used by generateValidResponses() to get the initial list of responses that it then filters.
	*generateResponses() {}

	// checks if two different responses are equivalent
	areResponseValuesEquivalent(a, b) {
		return a === b;
	}
}

export class ChooseCards extends InputRequest {
	constructor(player, cards, validAmounts, reason, validatorFunction = () => true) {
		super(player, "chooseCards");
		this.from = cards;
		this.validAmounts = validAmounts;
		this.reason = reason;
		this.validatorFunction = validatorFunction;
	}

	async extractResponseValue(response) {
		await super.extractResponseValue(response);

		return response.value.map(cardIndex => this.from[cardIndex]);
	}

	async validate(response) {
		const superValid = super.validate(response);
		if (superValid !== "") return superValid;

		// If a valid amount could have been selected, it should have been selected.
		// Otherwise, all available cards should have been selected.
		if (this.from.length > 0 && (
			this.validAmounts.length === 0 || this.validAmounts.some(amount => amount <= this.from.length)
		)) {
			if (!this.validAmounts.includes(response.length) && this.validAmounts.length > 0) {
				return "Chose invalid amount of cards.";
			}
		} else if (response.length != this.from.length) {
			return "Chose invalid amount of cards.";
		}
		for (let cardIndex of response) {
			if (cardIndex < 0 || cardIndex >= this.from.length) {
				return "Chose an invalid card index: " + cardIndex;
			}
		}
		const cards = response.map(cardIndex => this.from[cardIndex]);
		if (!this.validatorFunction(cards)) {
			return "Card selection did not satisfy special validation conditions.";
		}
		return "";
	}

	*generateResponses() {
		// we need to account for an empty list representing 'any amount'
		const validAmounts = this.validAmounts;
		if (validAmounts.length === 0) {
			for (let i = 1; i <= this.from.length; i++) {
				validAmounts.push(i);
			}
		}
		for (const amount of validAmounts) {
			if (amount > this.from.length) {
				continue;
			}
			for (const combination of nChooseK(this.from.length, amount)) {
				if (this.validatorFunction(combination.map(cardIndex => this.from[cardIndex]))) {
					yield combination;
				}
			}
		}
	}

	areResponseValuesEquivalent(a, b) {
		if (a.length !== b.length) return false;

		for (const num of a ) {
			if (!b.includes(num)) return false;
		}

		return true;
	}
}

export class ChoosePlayer extends InputRequest {
	constructor(player, reason) {
		super(player, "choosePlayer");
		this.reason = reason;
	}

	async extractResponseValue(response) {
		await super.extractResponseValue(response);

		return this.player.game.players[response.value];
	}

	async validate(response) {
		const superValid = super.validate(response);
		if (superValid !== "") return superValid;

		if (response < 0 || response >= this.player.game.players.length) {
			return "Chose an invalid player index: " + response;
		}
		return "";
	}

	*generateResponses() {
		yield 0;
		yield 1;
	}
}

export class ChooseType extends InputRequest {
	constructor(player, effect, types) {
		super(player, "chooseType");
		this.effect = effect;
		this.from = types;
	}

	async extractResponseValue(response) {
		await super.extractResponseValue(response);

		return this.from[response.value];
	}

	async validate(response) {
		const superValid = super.validate(response);
		if (superValid !== "") return superValid;

		if (typeof response != "number") {
			return "Supplied an incorrect response value. Expected 'number' but got '" + (typeof response) + "' instead."
		}

		if (response < 0 || response >= this.from.length) {
			return "Chose an invalid type index: " + response;
		}
		return "";
	}

	*generateResponses() {
		for (let i = 0; i < this.from.length; i++) {
			yield i;
		}
	}
}

export class ChooseDeckSide extends InputRequest {
	constructor(player, effect, deckOwner) {
		super(player, "chooseType");
		this.effect = effect;
		this.deckOwner = deckOwner;
	}

	async extractResponseValue(response) {
		await super.extractResponseValue(response);

		return new DeckPosition(this.deckOwner.deckZone, response.value === "top");
	}

	async validate(response) {
		const superValid = super.validate(response);
		if (superValid !== "") return superValid;

		if (response != "top" && response != "bottom") {
			return `Chose an invalid deck side: ${response} (must be either "top" or "bottom")`;
		}
		return "";
	}

	*generateResponses() {
		yield "top";
		yield "bottom";
	}
}

export class ChooseAbility extends InputRequest {
	constructor(player, effect, abilities) {
		super(player, "chooseAbility");
		this.effect = effect;
		this.from = abilities;
	}

	async extractResponseValue(response) {
		await super.extractResponseValue(response);

		return this.from[response.value];
	}

	async validate(response) {
		const superValid = super.validate(response);
		if (superValid !== "") return superValid;

		if (response < 0 || response >= this.from.length) {
			return "Chose an invalid ability index: " + response;
		}
		return "";
	}

	*generateResponses() {
		for (let i = 0; i < this.from.length; i++) {
			yield i;
		}
	}
}

export class OrderCards extends InputRequest {
	constructor(player, cards, reason) {
		super(player, "orderCards");
		this.cards = cards;
		this.reason = reason;
	}

	async extractResponseValue(response) {
		await super.extractResponseValue(response);

		return response.value.map(cardIndex => this.cards[cardIndex]);
	}

	async validate(response) {
		const superValid = super.validate(response);
		if (superValid !== "") return superValid;

		if (response.length != this.cards.length) {
			return "Supplied an incorrect amount of cards to order. Got " + response.length + " when it should have been between " + this.cards.length + ".";
		}
		let sortedResponse = response.toSorted();
		for (let i = 0; i < response.length; i++) {
			if (i != sortedResponse[i]) {
				return "Supplied incorrect card ordering indices. Got a " + sortedResponse[i] + " when there should have been a " + i + ".";
			}
		}
		return "";
	}

	*generateResponses() {
		for (const order of nChooseK(this.cards.length, this.cards.length)) {
			yield order;
		}
	}

	areResponseValuesEquivalent(a, b) {
		if (a.length !== b.length) return false;

		for (let i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) return false;
		}
		return true;
	}
}

export class ApplyActionModificationAbility extends InputRequest {
	constructor(player, ability, target) {
		super(player, "applyActionModificationAbility");
		this.ability = ability;
		this.target = target;
	}

	// extractResponseValue() does not need to be overidden.

	async validate(response) {
		const superValid = super.validate(response);
		if (superValid !== "") return superValid;

		if (typeof response !== "boolean") {
			return "Supplied an incorrect response value. Expected 'boolean' but got '" + (typeof response) + "' instead.";
		}
		return "";
	}

	*generateResponses() {
		yield true;
		yield false;
	}
}

export class EnterBattlePhase extends InputRequest {
	constructor(player) {
		super(player, "enterBattlePhase");
	}

	// extractResponseValue() does not need to be overidden.

	async validate(response) {
		const superValid = super.validate(response);
		if (superValid !== "") return superValid;

		if (typeof response !== "boolean") {
			return "Supplied an incorrect response value. Expected 'boolean' but got '" + (typeof response) + "' instead.";
		}
		return "";
	}

	*generateResponses() {
		yield true;
		yield false;
	}
}

// pass on block creation
export class Pass extends InputRequest {
	constructor(player) {
		super(player, "pass");
	}

	// extractResponseValue() does not need to be overidden.

	// validate() does not need to be overidden.

	*generateResponses() {
		yield null;
	}
}

export class DoStandardDraw extends InputRequest {
	constructor(player) {
		super(player, "doStandardDraw");
	}

	// extractResponseValue() does not need to be overidden.

	async validate(response) {
		// Doesn't need any actual validation
		return super.validate(response);
	}

	*generateResponses() {
		yield null;
	}
}

export class DoStandardSummon extends InputRequest {
	constructor(player, eligibleUnits) {
		super(player, "doStandardSummon");
		this.eligibleUnits = eligibleUnits;
	}

	async extractResponseValue(response) {
		await super.extractResponseValue(response);

		return this.player.handZone.cards[response.value];
	}

	async validate(response) {
		const superValid = super.validate(response);
		if (superValid !== "") return superValid;

		if (response < 0 || response >= this.player.handZone.cards.length) {
			return "Supplied out-of-range hand card index for a standard summon.";
		}
		if (!this.eligibleUnits.includes(this.player.handZone.cards[response])) {
			return "Tried to standard summon a non-eligible unit.";
		}
		return "";
	}

	*generateResponses() {
		for (let i = 0; i < this.player.handZone.cards.length; i++) {
			if (this.eligibleUnits.includes(this.player.handZone.cards[i])) {
				yield i;
			}
		}
	}
}

export class DeployItem extends InputRequest {
	constructor(player, eligibleItems, costOptionTrees) {
		super(player, "deployItem");
		this.eligibleItems = eligibleItems;
		this._costOptionTrees = costOptionTrees;
	}

	async extractResponseValue(response) {
		await super.extractResponseValue(response);

		return this.player.handZone.cards[response.value];
	}

	async validate(response) {
		const superValid = super.validate(response);
		if (superValid !== "") return superValid;

		if (response < 0 || response >= this.player.handZone.cards.length) {
			return "Supplied out-of-range hand card index for deploying an item.";
		}
		if (!this.eligibleItems.includes(this.player.handZone.cards[response])) {
			return "Tried to deploy a non-eligible item.";
		}
		return "";
	}

	*generateResponses() {
		for (let i = 0; i < this.player.handZone.cards.length; i++) {
			if (this.eligibleItems.includes(this.player.handZone.cards[i])) {
				yield i;
			}
		}
	}
}

export class CastSpell extends InputRequest {
	constructor(player, eligibleSpells, costOptionTrees) {
		super(player, "castSpell");
		this.eligibleSpells = eligibleSpells;
		this._costOptionTrees = costOptionTrees;
	}

	async extractResponseValue(response) {
		await super.extractResponseValue(response);

		return this.player.handZone.cards[response.value];
	}

	async validate(response) {
		const superValid = super.validate(response);
		if (superValid !== "") return superValid;

		if (response < 0 || response >= this.player.handZone.cards.length) {
			return "Supplied out-of-range hand card index for casting a spell.";
		}
		if (!this.eligibleSpells.includes(this.player.handZone.cards[response])) {
			return "Tried to cast a non-eligible spell.";
		}
		return "";
	}

	*generateResponses() {
		for (let i = 0; i < this.player.handZone.cards.length; i++) {
			if (this.eligibleSpells.includes(this.player.handZone.cards[i])) {
				yield i;
			}
		}
	}
}

export class DoAttackDeclaration extends InputRequest {
	constructor(player, eligibleUnits) {
		super(player, "doAttackDeclaration");
		this.eligibleUnits = eligibleUnits;
	}

	async extractResponseValue(response) {
		await super.extractResponseValue(response);

		return response.value.map(cardIndex => this.eligibleUnits[cardIndex]);
	}

	async validate(response) {
		const superValid = super.validate(response);
		if (superValid !== "") return superValid;

		for (let i = 0; i < response.length; i++) {
			if (response[i] < 0 || response[i] >= this.eligibleUnits.length) {
				return "Chose an invalid attacker index for attack declaration: " + cardIndex;
			}
			if (response.indexOf(response[i]) !== i) {
				return "Tried to make a unit participate twice in one attack.";
			}
		}
		response = response.map(cardIndex => this.eligibleUnits[cardIndex]);
		if (response.length > 1) {
			const partner = response.find(card => card.zone.type === "partner");
			if (!partner) {
				return "Tried to peform a combined attack without declaring the partner to attack.";
			}
			for (const unit of response) {
				if (!unit.sharesTypeWith(partner)) {
					return "Tried to peform a combined attack where some participants do not share a type with the partner.";
				}
			}
		}
		return "";
	}

	*generateResponses() {
		for (let i = 0; i < this.eligibleUnits.length; i++) {
			yield [i];
		}
		const partner = this.eligibleUnits.find(card => card.zone.type === "partner");
		if (partner) {
			const eligibleForCombinedAttack = [];
			for (let i = 0; i < this.eligibleUnits.length; i++) {
				if (
					this.eligibleUnits[i] !== partner &&
					partner.sharesTypeWith(this.eligibleUnits[i])
				) {
					eligibleForCombinedAttack.push(i);
				}
			}
			const partnerIndex = this.eligibleUnits.indexOf(partner);
			for (let i = 0; i < eligibleForCombinedAttack.length; i++) {
				for (const combination of nChooseK(eligibleForCombinedAttack.length, i)) {
					yield [partnerIndex, ...combination.map(i => eligibleForCombinedAttack[i])];
				}
			}
		}
	}

	areResponseValuesEquivalent(a, b) {
		if (a.length !== b.length) return false;

		for (const num of a) {
			if (!b.includes(num)) return false;
		}
		return true;
	}
}

export class DoFight extends InputRequest {
	constructor(player) {
		super(player, "doFight");
	}

	// extractResponseValue() does not need to be overidden.

	// validate() does not need to be overidden.

	*generateResponses() {
		yield null;
	}
}

export class DoRetire extends InputRequest {
	constructor(player, eligibleUnits) {
		super(player, "doRetire");
		this.eligibleUnits = eligibleUnits;
	}

	async extractResponseValue(response) {
		await super.extractResponseValue(response);

		return response.value.map(cardIndex => this.eligibleUnits[cardIndex]);
	}

	async validate(response) {
		const superValid = super.validate(response);
		if (superValid !== "") return superValid;

		for (const cardIndex of response) {
			if (cardIndex < 0 || cardIndex >= this.eligibleUnits.length) {
				return "Chose an invalid unit retire index: " + cardIndex;
			}
		}

		return "";
	}

	*generateResponses() {
		for (let i = 1; i <= this.eligibleUnits.length; i++) {
			for (const combination of nChooseK(this.eligibleUnits.length, i)) {
				yield combination;
			}
		}
	}

	areResponseValuesEquivalent(a, b) {
		if (a.length !== b.length) return false;

		for (const num of a) {
			if (!b.includes(num)) return false;
		}
		return true;
	}
}

export class ActivateOptionalAbility extends InputRequest {
	constructor(player, eligibleAbilities) {
		super(player, "activateOptionalAbility");
		this.eligibleAbilities = eligibleAbilities;
	}

	async extractResponseValue(response) {
		await super.extractResponseValue(response);

		return this.eligibleAbilities[response.value];
	}

	async validate(response) {
		const superValid = super.validate(response);
		if (superValid !== "") return superValid;

		if (response < 0 || response >= this.eligibleAbilities.length) {
			return "Supplied out-of-range ability index for activating an optional ability.";
		}

		return "";
	}

	*generateResponses() {
		for (let i = 0; i < this.eligibleAbilities.length; i++) {
			yield i;
		}
	}
}

export class ActivateFastAbility extends InputRequest {
	constructor(player, eligibleAbilities) {
		super(player, "activateFastAbility");
		this.eligibleAbilities = eligibleAbilities;
	}

	async extractResponseValue(response) {
		await super.extractResponseValue(response);

		return this.eligibleAbilities[response.value];
	}

	async validate(response) {
		const superValid = super.validate(response);
		if (superValid !== "") return superValid;

		if (response < 0 || response >= this.eligibleAbilities.length) {
			return "Supplied out-of-range ability index for activating a fast ability.";
		}

		return "";
	}

	*generateResponses() {
		for (let i = 0; i < this.eligibleAbilities.length; i++) {
			yield i;
		}
	}
}

export class ActivateTriggerAbility extends InputRequest {
	constructor(player, eligibleAbilities) {
		super(player, "activateTriggerAbility");
		this.eligibleAbilities = eligibleAbilities;
	}

	async extractResponseValue(response) {
		await super.extractResponseValue(response);

		return this.eligibleAbilities[response.value];
	}

	async validate(response) {
		const superValid = super.validate(response);
		if (superValid !== "") return superValid;

		if (response < 0 || response >= this.eligibleAbilities.length) {
			return "Supplied out-of-range ability index for activating a trigger ability.";
		}

		return "";
	}

	*generateResponses() {
		for (let i = 0; i < this.eligibleAbilities.length; i++) {
			yield i;
		}
	}
}

export class ChooseZoneSlot extends InputRequest {
	constructor(player, zone, eligibleSlots) {
		super(player, "chooseZoneSlot");
		this.zone = zone;
		this.eligibleSlots = eligibleSlots;
	}

	async extractResponseValue(response) {
		await super.extractResponseValue(response);

		return this.eligibleSlots[response.value];
	}

	async validate(response) {
		const superValid = super.validate(response);
		if (superValid !== "") return superValid;

		if (response < 0 || response >= this.eligibleSlots.length) {
			return "Supplied out-of-range zone slot index '" + response + "'. It should have been between 0 and " + this.eligibleSlots.length + ".";
		}

		return "";
	}

	*generateResponses() {
		for (let i = 0; i < this.eligibleSlots.length; i++) {
			yield i;
		}
	}
}

export class ChooseAbilityOrder extends InputRequest {
	constructor(player, card, abilities) {
		super(player, "chooseAbilityOrder");
		this.abilities = abilities;
		this.applyTo = card;
	}

	// extractResponseValue() does not need to be overidden.

	async validate(response) {
		const superValid = super.validate(response);
		if (superValid !== "") return superValid;

		if (response.length != this.abilities.length) {
			return "Supplied incorrect amount of abilities to order. Got " + response.length + " when it should have been between " + this.abilities.length + ".";
		}
		let sortedResponse = response.toSorted();
		for (let i = 0; i < response.length; i++) {
			if (i != sortedResponse[i]) {
				return "Supplied incorrect ability ordering indices. Got a " + sortedResponse[i] + " when there should have been a " + i + ".";
			}
		}

		return "";
	}

	*generateResponses() {
		for (const order of nChooseK(this.abilities.length, this.abilities.length)) {
			yield order;
		}
	}

	areResponseValuesEquivalent(a, b) {
		if (a.length !== b.length) return false;

		for (let i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) return false;
		}
		return true;
	}
}

export class SelectTokenAmount extends InputRequest {
	constructor(player, eligibleAmounts) {
		super(player, "selectTokenAmount");
		this.eligibleAmounts = eligibleAmounts;
	}

	// extractResponseValue() does not need to be overidden.

	async validate(response) {
		const superValid = super.validate(response);
		if (superValid !== "") return superValid;

		if (!this.eligibleAmounts.includes(response)) {
			return "Supplied incorrect amount of tokens to summon. Got " + response + " when it should have been between any of these: " + this.eligibleAmounts;
		}

		return "";
	}

	*generateResponses() {
		for (const amount of this.eligibleAmounts) {
			yield amount;
		}
	}
}