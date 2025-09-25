import {BaseCard} from "../card.mjs";
import {capturedVariables} from "./parser.mjs";

// Types which are treated as sets (forbidding duplicate values)
// This is anything that represents non-fungible objects, like cards or players, as opposed to numbers or card types.
const setTypes = ["card", "player", "fight"];
function deduplicate(array) {
	for (let i = 0; i < array.length - 1; i++) {
		for (let j = i + 1; j < array.length; j++) {
			if (equalityCompare(array[i], array[j])) {
				array.splice(j, 1);
				j--;
			}
		}
	}
}

export class ScriptValue {
	#isSplit;
	#value;
	constructor(type, value) {
		this.type = type;
		this.#isSplit = value instanceof Map;
		if (setTypes.includes(type)) {
			if (this.#isSplit) {
				for (const [_, val] of value) {
					deduplicate(val);
				}
			} else {
				deduplicate(value);
			}
		}
		this.#value = value;
	}

	// Returns the given player's version of this value.
	get(player) {
		if (this.#isSplit) {
			if (!player) throw new Error("Cannot read a split variable without providing a player!");
			return this.#value.get(player);
		}
		return this.#value;
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
					if (equalityCompare(elemA, elemB)) return true;
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
				if (b.some(elemB => equalityCompare(elemA, elemB))) {
					return false;
				}
			}
			return true;
		}
		return a !== b;
	}
	plus(other, player) {
		if (this.type !== other.type) {
			throw new Error(`Cannot add a value of type '${other.type}' to one of type '${this.type}'!`);
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
				const retVal = this.get(player).concat(other.get(player));
				// de-duplicate identical values if this type is a set.
				if (setTypes.includes(this.type)) {
					deduplicate(retVal);
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
					if (otherValues.some(elem => equalityCompare(elem, element))) {
						if (!setTypes.includes(this.type)) {
							otherValues.splice(otherValues.findIndex(elem => equalityCompare(elem, element)), 1);
						}
					} else {
						retVal.push(element);
					}
				}
				return retVal;
			}
		}
	}
}
// compares two cdfScript values
export function equalityCompare(elemA, elemB) {
	switch (true) {
		case elemA instanceof BaseCard: {
			return elemA.globalId === elemB.globalId;
		}
		case elemA instanceof TurnValue: {
			return elemA.getIndex() === elemB.getIndex();
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

		// Used when context is frozen for use in a modifier (like on 'Mystical Circle')
		// or when freezing captured variables at the start of a script so that the script cannot inadvertantly modify them (through things that reset variables, like moving cards)
		this.variables = {};
	}

	// returns a new context, which is a copy of this one, except that it has captured the current variables in the ability.
	// currently only used for modifiers (mainly in the APPLY function, in case they have backreferences)
	asFrozenContext() {
		const ctx = new ScriptContext(this.card, this.player, this.ability, this.evaluatingPlayer);
		ctx.variables = {...this.variables};
		for (const [key, value] of Object.entries(this.ability?.scriptVariables ?? {})) {
			if (capturedVariables[this.ability.id]?.includes(key)) {
				ctx.variables[key] ??= value.map(val => val? new ScriptValue(val.type, val.get(this.player)) : val);
			} else {
				ctx.variables[key] ??= new ScriptValue(value.type, value.get(this.player));
			}
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

export class TimeIndicator {
	constructor(type, turn = null, phaseType = null) {
		this.type = type; // "forever", "endOfTurn", "phase"
		this.turn = turn;
		this.phaseType = phaseType;
	}

	// gets the list that an action needs to be put into for it to happen at this point in time
	getGeneratorList(game) {
		switch (this.type) {
			case "forever": {
				return null;
			}
			case "endOfTurn": {
				const index = this.turn.getIndex();
				const currentTurn = game.currentTurn();
				if (index === currentTurn.index) {
					return currentTurn.actionLists.end;
				}
				return game.upcomingTurnActions[(index - currentTurn.index) - 1].end;
			}
			case "phase": {
				const index = this.turn.getIndex();
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
	#game;
	constructor(player = null, next = false, game = player.game) {
		this.player = player;
		this.next = next;
		this.#game = game;
	}

	getIndex() {
		if (this.player) {
			let currentPlayer = this.#game.currentTurn().player;
			if (currentPlayer === this.player) {
				return this.#game.currentTurn().index + (this.next? this.#game.players.length : 0);
			}
			let currentIndex = this.#game.currentTurn().index;
			while (currentPlayer !== this.player) {
				currentPlayer = currentPlayer.next();
				currentIndex++;
			}
			return currentIndex;
		} else {
			return this.#game.currentTurn().index + (this.next? 1 : 0);
		}
	}
}
