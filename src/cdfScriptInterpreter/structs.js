import {BaseCard} from "../card.js";

export class ScriptValue {
	constructor(type, value) {
		this.type = type;
		this._isSplit = value instanceof Map;
		this._value = value;
	}

	// Returns the given player's version of this value.
	get(player) {
		if (this._isSplit) {
			if (!player) throw new Error("Cannot read a split variable without providing a player!");
			return this._value.get(player);
		}
		return this._value;
	}

	// Returns this value as a single number.
	// The 'any' value is represented by infinity, non-number values by NaN.
	getJsNum(player) {
		let val = this.get(player);
		if (val === "any") return Infinity;
		if (typeof val[0] === "number") return val[0];
		return NaN;
	}

	// TODO: make comparison nodes use this and write functions for other operators
	equals(other, player) {
		if (this.type !== other.type) {
			return false;
		}
		let a = this.get(player);
		let b = other.get(player);
		if (a instanceof Array) {
			for (const elemA of a) {
				for (const elemB of b) {
					if (elemA instanceof BaseCard && elemB instanceof BaseCard) {
						if (elemA.globalId === elemB.globalId) return true;
					} else {
						if (elemA === elemB) return true;
					}
				}
			}
			return false;
		}
		return a === b;
	}
}

// This is an execution context for cdfScript
// Ability may be null but card and player are guaranteed to always exist
export class ScriptContext {
	constructor(card, player, ability = null, evaluatingPlayer = null) {
		this.game = player.game; // just for convenience
		this.card = card; // The card that the portion of script currently resides on
		this.player = player; // The player executing the script
		this.evaluatingPlayer = evaluatingPlayer; // The player evaluating the script (cards may be hidden from the script like this)
		this.ability = ability; // The ability that the script belongs to
	}
}

export class DeckPosition {
	constructor(decks, isTop) {
		this.decks = decks;
		this.isTop = isTop;
	}
}