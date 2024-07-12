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
		let val = this.get(player);
		if (val instanceof SomeOrMore) return Infinity;
		if (typeof val[0] === "number") return val[0];
		return NaN;
	}

	// TODO: write functions for other operators
	equals(other, player) {
		if (this.type !== other.type) {
			return false;
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
}
// compares two scripting
function equalityCompare(elemA, elemB, game) {
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
		this.player = player; // The player executing the script
		this.evaluatingPlayer = evaluatingPlayer; // The player evaluating the script (cards may be hidden from the script like this)
		this.ability = ability; // The ability that the script belongs to
		this.targets = targets;
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

	// gets the list that an 'undo' step needs to be put into for actions that can be applied until a certain point
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