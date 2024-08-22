import {BaseCard} from "../card.mjs";

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
	// The 'any' value (and 'x+' values) are represented by infinity, non-number values by NaN.
	getJsNum(player) {
		const val = this.get(player);
		if (val instanceof SomeOrMore) return Infinity;
		if (typeof val[0] === "number") return val[0];
		return NaN;
	}
	// Returns this as a single bool, either true or false.
	// If any of the bools in the array are true, this is true.
	getJsBool(player) {
		const val = this.get(player);
		return val.some(b => b); // if any are true, this is true
	}
	getJsVal(player) {
		switch(this.type) {
			case "number": {
				return this.getJsNum(player);
			}
			case "bool": {
				return this.getJsBool(player);
			}
			default: {
				return this.get(player);
			}
		}
	}

	// TODO: write functions for other operators
	equals(other, player) {
		if (this.type !== other.type) {
			return false;
		}
		if (this.type === "bool") {
			return this.getJsBool(player) === other.getJsBool(player);
		}

		let a = this.get(player);
		let b = other.get(player);
		if (a instanceof Array) {
			for (const elemA of a) {
				for (const elemB of b) {
					if (equalityCompare(elemA, elemB, player.game)) return true;
				}
			}
			return false;
		}
		return a === b;
	}
	notEquals(other, player) {
		if (this.type !== other.type) {
			return true;
		}
		if (this.type === "bool") {
			return this.getJsBool(player) !== other.getJsBool(player);
		}

		let a = this.get(player);
		let b = other.get(player);
		if (a instanceof Array) {
			for (const elemA of a) {
				if (b.some(elemB => equalityCompare(elemA, elemB, player.game))) {
					return false;
				}
			}
			return true;
		}
		return a !== b;
	}
	plus(other, player) {
		if (this.type !== other.type) {
			throw new Error(`Cannot add a value of type '${this.type}' to one of type '${other.type}'!`);
		}
		switch (this.type) {
			case "number": {
				return [this.get(player)[0] + other.get(player)[0]];
			}
			case "bool": {
				throw new Error("Cannot add values of type 'bool' together!");
			}
			default: {
				// for non-number types this concatenates the two lists.
				// TODO: maybe limit this to the types where it actually makes sense.
				//       deduplication also causes weird inconsistencies with COUNT() or SUM() functions and should probably only apply if these are unique values. (like cards or players)
				const retVal = this.get(player).concat(other.get(player));
				// de-duplicate identical values
				for (let i = 0; i < retVal.length - 1; i++) {
					for (let j = i + 1; j < retVal.length; j++) {
						if (equalityCompare(retVal[i], retVal[j], player.game)) {
							retVal.splice(j, 1);
							j--;
						}
					}
				}
				return retVal;
			}
		}
	}
	minus(other, player) {
		if (this.type !== other.type) {
			throw new Error(`Cannot subtract a value of type '${this.type}' from one of type '${other.type}'!`);
		}
		switch (this.type) {
			case "number": {
				return [this.get(player)[0] - other.get(player)[0]];
			}
			case "bool": {
				throw new Error("Cannot subtract values of type 'bool' from each other!");
			}
			default: {
				// for non-number types this removes everything in other from this.
				const retVal = [];
				const otherValues = other.get(player);
				for (const element of this.get(player)) {
					if (!otherValues.some(elem => equalityCompare(elem, element, player.game))) {
						retVal.push(element);
					}
				}
				return retVal;
			}
		}
	}
}
// compares two cdfScript values
export function equalityCompare(elemA, elemB, game) {
	switch (true) {
		case elemA instanceof BaseCard: {
			return elemA.globalId === elemB.globalId;
		}
		case elemA instanceof TurnValue: {
			return elemA.getIndex(game) === elemB.getIndex(game);
		}
		default: {
			return elemA === elemB;
		}
	}
}

// This is an execution context for cdfScript
// Ability may be null but card and player are guaranteed to always exist
export class ScriptContext {
	constructor(card, player, ability = null, evaluatingPlayer = null, targets = new TargetObjects()) {
		this.game = player.game; // just for convenience
		this.card = card; // The card that the portion of script currently resides on
		this.player = player; // The player executing the script (= doing what it says)
		this.youPlayer = card.currentOwner(); // The player that activated the ability, except // TODO: actually make this functional
		this.evaluatingPlayer = evaluatingPlayer; // The player evaluating the script (cards that that player can't see are hidden from the script if set)
		this.ability = ability; // The ability that the script belongs to
		this.targets = targets; // which objects have already been chosen as targets over the course of the ability

		// only used when context is frozen for use in a modifier (like on 'Mystical Circle')
		this.variables = {};
	}

	// returns a new context, which is a copy of this one, except that it has captured the current variables in the ability
	// currently only used for modifiers (mainly in the APPLY function)
	freeze() {
		const ctx = new ScriptContext(this.card, this.player, this.ability, this.evaluatingPlayer);
		for (const [key, value] of Object.entries(this.ability?.scriptVariables ?? {})) {
			ctx.variables[key] = new ScriptValue(value.type, value.get(this.player));
		}
		return ctx;
	}
}

// used to keep track of targeted objects of different types to prevent selecting the same target twice in an ability
// this is separate from ScriptContext so that multiple contexts can share the same targets. (one ability can have multiple contexts during processing)
export class TargetObjects {
	constructor() {
		this.card = [];
		this.player = [];
		this.abilityId = [];
	}
}

// A number value that represents things like "5 or more"
// (written in cdfScript as "5+")
export class SomeOrMore {
	constructor(lowest) {
		this.lowest = lowest;
	}
}

// A zone value that represents either the top or bottom of a deck
export class DeckPosition {
	constructor(deck, isTop) {
		this.deck = deck;
		this.isTop = isTop;
	}
}

export class UntilIndicator {
	constructor(type, turn = null, phaseType = null) {
		this.type = type; // "forever", "endOfTurn", "phase"
		this.turn = turn;
		this.phaseType = phaseType;
	}

	// gets the list that an 'undo' step needs to be put into for actions that can be applied until a certain point or, in case of 'forever', returns null
	getStepList(game) {
		switch (this.type) {
			case "forever": {
				return null;
			}
			case "endOfTurn": {
				const index = this.turn.getIndex(game);
				const currentTurn = game.currentTurn();
				if (index === currentTurn.index) {
					return currentTurn.actionLists.end;
				}
				return game.upcomingTurnActions[(index - currentTurn.index) - 1].end;
			}
			case "phase": {
				const index = this.turn.getIndex(game);
				const currentTurn = game.currentTurn();
				if (index === currentTurn.index) {
					return currentTurn.actionLists[this.phaseType];
				}
				return game.upcomingTurnActions[(index - currentTurn.index) - 1][this.phaseType];
			}
		}
	}
}

export class TurnValue {
	constructor(player = null, next = false) {
		this.player = player;
		this.next = next;
	}

	getIndex(game) {
		if (this.player) {
			let currentPlayer = game.currentTurn().player;
			if (currentPlayer === this.player) {
				return game.currentTurn().index + (this.next? game.players.length : 0);
			}
			let currentIndex = game.currentTurn().index;
			while (currentPlayer !== this.player) {
				currentPlayer = currentPlayer.next();
				currentIndex++;
			}
			return currentIndex;
		} else {
			return game.currentTurn().index + (this.next? 1 : 0);
		}
	}
}