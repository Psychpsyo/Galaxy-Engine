// This module exports the definition for all nodes required for the CDF Script abstract syntax tree

import * as actions from "../actions.js";
import * as blocks from "../blocks.js";
import * as zones from "../zones.js";
import {BaseCard} from "../card.js";
import {Modifier} from "../valueModifiers.js";
import {ScriptValue, ScriptContext, DeckPosition} from "./structs.js";
import {functions, initFunctions} from "./functions.js";
import {cartesianProduct} from "../math.js";

let implicit = {
	card: [null],
	action: [null],
	player: [null]
}

// helper functions
function equalityCompare(a, b) {
	if (a instanceof BaseCard && b instanceof BaseCard) {
		return a.globalId === b.globalId;
	}
	return a === b;
}
export function setImplicit(objects, type) {
	implicit[type].push(objects);
}
export function clearImplicit(type) {
	implicit[type].pop();
}

class AstNode {
	constructor(returnType) {
		this.returnType = returnType; // null indicates no return type
	}

	* eval(ctx) {}
	// evalFull() does the same as eval without being a generator function itself.
	// This means that it will return an array of all possible return values for every combination of choices
	// that the player could make.
	// If run with an evaluatingPlayer, information that is hidden from that player is ignored.
	// This means that card matchers, for example, will always return hidden cards, no matter if they actually match.
	evalFull(ctx) {
		let generator = this.eval(ctx);
		let next;
		do {
			next = generator.next();
		} while (!next.done);
		return [next.value];
	}
	// whether or not all actions in this tree have enough targets to specify the target availability rule.
	hasAllTargets(ctx) {
		for (let childNode of this.getChildNodes()) {
			if (childNode && !childNode.hasAllTargets(ctx)) {
				return false;
			}
		}
		return true;
	}
	getChildNodes() {
		return [];
	}
}

// This serves as the root node of a card's script body
export class ScriptRootNode extends AstNode {
	constructor(steps) {
		super(null);
		this.steps = steps;
	}
	* eval(ctx) {
		for (let step of this.steps) {
			yield* step.eval(ctx);
		}
	}
	// whether or not all actions in this tree have enough targets to specify the target availability rule.
	hasAllTargets(ctx) {
		return this.hasAllTargetsFromStep(0, ctx);
	}
	getChildNodes() {
		return this.steps;
	}

	hasAllTargetsFromStep(i, ctx) {
		for (; i < this.steps.length; i++) {
			if (!this.steps[i].hasAllTargets(ctx)) {
				return false;
			}
			// If this step is a variable assignment, we need to enumerate all possible values
			// of the right-hand expression (as it may depend on player choice) and then
			// check target availability for the rest of the script with those choices made.
			// If just one of those branches has all targets, the ability is said to have all targets.
			if (this.steps[i].assignTo) {
				let oldVarValue = ctx.ability.scriptVariables[this.steps[i].assignTo];
				let foundValidBranch = false;
				for (const possibility of this.steps[i].evalFull(ctx)) {
					ctx.ability.scriptVariables[this.steps[i].assignTo] = possibility;
					if (this.hasAllTargetsFromStep(i + 1, ctx)) {
						foundValidBranch = true;
						break;
					}
				}
				ctx.ability.scriptVariables[this.steps[i].assignTo] = oldVarValue;
				return foundValidBranch;
			}
		}
		return true;
	}
}

export class LineNode extends AstNode {
	constructor(expression, variable) {
		super(expression.returnType);
		this.expression = expression;
		this.assignTo = variable;
	}
	* eval(ctx) {
		let returnValue = yield* this.expression.eval(ctx);
		if (this.assignTo) {
			ctx.ability.scriptVariables[this.assignTo] = returnValue;
		}
		return returnValue;
	}
	evalFull(ctx) {
		return this.expression.evalFull(ctx);
	}
	getChildNodes() {
		return [this.expression];
	}
}

export class TriggerRootNode extends AstNode {
	constructor(expression) {
		super(expression.returnType);
		this.expression = expression;
	}
	* eval(ctx) {
		setImplicit(ctx.game.currentPhase().lastActionList, "action");
		let returnValue = yield* this.expression.eval(ctx);
		clearImplicit("action");
		return returnValue;
	}
	getChildNodes() {
		return this.expression;
	}
}

// Represents the language's built-in functions
export class FunctionNode extends AstNode {
	constructor(functionName, parameters, player, asManyAsPossible) {
		super(functions[functionName].returnType);
		this.function = functions[functionName];
		this.parameters = parameters;
		this.player = player;
		this.asManyAsPossible = asManyAsPossible;
	}
	* eval(ctx) {
		let players = (yield* this.player.eval(ctx)).get(ctx.player);
		if (players.length == 1) {
			const value = yield* this.function.run(this, new ScriptContext(ctx.card, players[0], ctx.ability));
			if (value.type === "tempActions") { // actions need to be executed
				const actions = value.get(ctx.player);
				const timing = yield actions;
				let values = [];
				for (const action of timing.actions) {
					if (actions.includes(action) && !action.isCancelled) {
						const actualValues = this.function.finalizeReturnValue(action);
						if (actualValues !== undefined) values = values.concat(actualValues);
					}
				}
				return new ScriptValue(this.function.returnType, values);
			} else {
				return value;
			}
		}
		// otherwise this is a both.FUNCTION() and must create a split value, while executing for the turn player first
		players.unshift(players.splice(players.indexOf(ctx.game.currentTurn().player), 1)[0]);
		let valueMap = new Map();
		let type;
		for (const player of players) {
			let value = yield* this.function.run(this, new ScriptContext(ctx.card, player, ctx.ability, ctx.evaluatingPlayer));
			type = value.type;
			valueMap.set(player, value.get(player));
		}

		if (type === "tempActions") { // actions need to be executed
			type = this.function.returnType;

			let actions = [];
			for (const iterPlayer of players) {
				actions = actions.concat(valueMap.get(iterPlayer));
			}
			const timing = yield actions;
			valueMap = new Map();

			for (const action of timing.actions) {
				if (actions.includes(action) && !action.isCancelled) {
					const actualValues = this.function.finalizeReturnValue(action);
					if (actualValues !== undefined) valueMap.set(action.player, (valueMap.get(action.player) ?? []).concat(actualValues));
				}
			}
		}
		return new ScriptValue(type, valueMap);
	}
	evalFull(ctx) {
		let players = this.player.evalFull(ctx)[0].get(ctx.player);
		if (players.length == 1) {
			const result =
				this.function.runFull?.(this, new ScriptContext(ctx.card, players[0], ctx.ability, ctx.evaluatingPlayer)) ??
				super.evalFull(new ScriptContext(ctx.card, players[0], ctx.ability, ctx.evaluatingPlayer));
			if (result.type === "tempActions") { // actions need to be executed
				return new ScriptValue(
					this.function.returnType,
					result.get(ctx.player).map(action => this.function.finalizeReturnValue(action)).filter(val => val !== undefined).flat()
				);
			}
			return result;
		}
		// otherwise this is a both.FUNCTION() and must create split values, while executing for the turn player first
		players.unshift(players.splice(players.indexOf(ctx.game.currentTurn().player), 1)[0]);
		let values = [];
		for (const player of players) {
			values.push(this.function.runFull?.(this, new ScriptContext(ctx.card, player, ctx.ability, ctx.evaluatingPlayer)));
		}
		return cartesianProduct(values).map(list => {
			let valueMap = new Map();
			for (let i = 0; i < list.length; i++) {
				valueMap.set(
					players[i],
					list[i].get(players[i]).map(action => this.function.finalizeReturnValue(action)).filter(val => val !== undefined).flat()
				);
			}
			return new ScriptValue(this.function.returnType, valueMap);
		});
	}
	hasAllTargets(ctx) {
		let players = this.player.evalFull(ctx)[0].get(ctx.player);
		for (const player of players) {
			let context = new ScriptContext(ctx.card, player, ctx.ability, ctx.evaluatingPlayer);
			// checks if all child nodes have their targets
			if (!super.hasAllTargets(context)) return false;
			// then checks function-specific requirements
			if (!this.function.hasAllTargets(this, context)) return false;
		}
		return true;
	}
	getChildNodes() {
		return this.parameters.concat([this.player]);
	}
}

export class CardMatchNode extends AstNode {
	constructor(cardListNodes, conditions) {
		super("card");
		this.cardListNodes = cardListNodes;
		this.conditions = conditions;
	}
	* eval(ctx) {
		return new ScriptValue("card", yield* this.getMatchingCards(ctx));
	}
	evalFull(ctx) {
		let generator = this.getMatchingCards(ctx);
		let next;
		do {
			next = generator.next();
		} while (!next.done);
		return [new ScriptValue("card", next.value)];
	}
	getChildNodes() {
		return this.cardListNodes.concat(this.conditions);
	}

	* getMatchingCards(ctx) {
		let cards = [];
		let matchingCards = [];
		for (let cardList of this.cardListNodes) {
			cardList = (yield* cardList.eval(ctx)).get(ctx.player);
			if (cardList.length > 0 && (cardList[0] instanceof zones.Zone)) {
				cards.push(...(cardList.map(zone => zone.cards).flat()));
			} else {
				cards.push(...cardList);
			}
		}
		for (let checkCard of cards) {
			if (checkCard == null) {
				continue;
			}
			// If the evaluating player can't see the cards, they should all be treated as valid / matching.
			if (checkCard.hiddenFor.includes(ctx.evaluatingPlayer) && checkCard.zone !== ctx.evaluatingPlayer.deckZone) {
				matchingCards.push(checkCard);
				continue;
			}
			setImplicit([checkCard], "card");
			if ((!this.conditions || (yield* this.conditions.eval(ctx)).get(ctx.player))) {
				matchingCards.push(checkCard);
				clearImplicit("card");
				continue;
			}
			clearImplicit("card");
		}
		return matchingCards;
	}
}
export class ThisCardNode extends AstNode {
	constructor() {
		super("card");
	}
	* eval(ctx) {
		const card = ctx.card.current();
		return new ScriptValue("card", card? [card] : []);
	}
}
export class AttackTargetNode extends AstNode {
	constructor() {
		super("card");
	}
	* eval(ctx) {
		if (ctx.game.currentAttackDeclaration?.target) {
			return new ScriptValue("card", [ctx.game.currentAttackDeclaration.target]);
		}
		return new ScriptValue("card", []);
	}
}
export class AttackersNode extends AstNode {
	constructor() {
		super("card");
	}
	* eval(ctx) {
		if (ctx.game.currentAttackDeclaration) {
			return new ScriptValue("card", ctx.game.currentAttackDeclaration.attackers);
		}
		return new ScriptValue("card", []);
	}
}

export class ImplicitValuesNode extends AstNode {
	constructor(returnType) {
		super(returnType);
	}
	* eval(ctx) {
		return new ScriptValue(this.returnType, implicit[this.returnType][implicit[this.returnType].length - 1]);
	}
}

export class CardPropertyNode extends AstNode {
	constructor(cards, property) {
		super({
			"name": "cardId",
			"baseName": "cardId",
			"level": "number",
			"baseLevel": "number",
			"types": "type",
			"baseTypes": "type",
			"abilities": "ability",
			"baseAbilities": "ability",
			"attack": "number",
			"baseAttack": "number",
			"defense": "number",
			"baseDefense": "number",
			"cardType": "cardType",
			"baseCardType": "cardType",
			"owner": "player",
			"baseOwner": "player",
			"equippedUnit": "card",
			"equipments": "card",
			"attackRights": "number",
			"attacksMade": "number",
			"canAttack": "bool",
			"canCounterattack": "bool",
			"fightingAgainst": "card",
			"self": "card",
			"zone": "zone",
			"isToken": "bool"
		}[property]);
		this.cards = cards;
		this.property = property;
	}

	* eval(ctx) {
		let cards = (yield* this.cards.eval(ctx)).get(ctx.player);
		let retVal = cards.map(card => this.accessProperty(card)).flat();
		if (this.returnType === "bool") {
			for (const value of retVal) {
				if (value === true) {
					retVal = true;
					break;
				}
			}
		}
		return new ScriptValue(this.returnType, retVal);
	}

	evalFull(ctx) {
		return this.cards.evalFull(ctx).map(possibility => new ScriptValue(this.returnType, possibility.get(ctx.player).map(card => this.accessProperty(card)).flat()));
	}

	getChildNodes() {
		return [this.cards];
	}

	accessProperty(card) {
		switch(this.property) {
			case "name": {
				return card.values.current.names;
			}
			case "baseName": {
				return card.values.base.names;
			}
			case "level": {
				return card.values.current.level;
			}
			case "baseLevel": {
				return card.values.base.level;
			}
			case "types": {
				return card.values.current.types;
			}
			case "baseTypes": {
				return card.values.base.types;
			}
			case "abilities": {
				return card.values.current.abilities;
			}
			case "baseAbilities": {
				return card.values.base.abilities;
			}
			case "attack": {
				return card.values.current.attack;
			}
			case "baseAttack": {
				return card.values.base.attack;
			}
			case "defense": {
				return card.values.current.defense;
			}
			case "baseDefense": {
				return card.values.base.defense;
			}
			case "cardType": {
				return card.values.current.cardTypes;
			}
			case "baseCardType": {
				return card.values.base.cardTypes;
			}
			case "owner": {
				return card.currentOwner();
			}
			case "baseOwner": {
				return card.owner;
			}
			case "equippedUnit": {
				return card.equippedTo? card.equippedTo : [];
			}
			case "equipments": {
				return card.equipments;
			}
			case "attackRights": {
				return card.values.current.attackRights;
			}
			case "attacksMade": {
				return card.attackCount;
			}
			case "canAttack": {
				return card.values.current.canAttack;
			}
			case "canCounterattack": {
				return card.values.current.canCounterattack;
			}
			case "fightingAgainst": {
				let currentBlock = card.owner.game.currentBlock();
				if (currentBlock instanceof blocks.Fight) {
					if (card.isAttackTarget) {
						return currentBlock.attackDeclaration.attackers;
					}
					if (card.isAttacking) {
						return currentBlock.attackDeclaration.target? currentBlock.attackDeclaration.target : [];
					}
				}
				return [];
			}
			case "self": {
				return card;
			}
			case "zone": {
				return card.zone;
			}
			case "isToken": {
				return card.isToken;
			}
		}
	}
}

export class PlayerPropertyNode extends AstNode {
	constructor(players, property) {
		super({
			"life": "number",
			"mana": "number",
			"partner": "card",
			"manaGainAmount": "number",
			"standardDrawAmount": "number",
			"needsToPayForPartner": "bool"
		}[property]);
		this.players = players;
		this.property = property;
	}

	* eval(ctx) {
		let players = (yield* this.players.eval(ctx)).get(ctx.player);
		let retVal = players.map(player => this.accessProperty(player)).flat();
		if (this.returnType === "bool") {
			for (const value of retVal) {
				if (value === true) {
					retVal = true;
					break;
				}
			}
		}
		return new ScriptValue(this.returnType, retVal);
	}

	evalFull(ctx) {
		return this.players.evalFull(ctx).map(possibility => new ScriptValue(this.returnType, possibility.get(ctx.player).map(player => this.accessProperty(player)).flat()));
	}

	getChildNodes() {
		return [this.players];
	}

	accessProperty(player) {
		switch(this.property) {
			case "life": {
				return player.life;
			}
			case "mana": {
				return player.mana;
			}
			case "partner": {
				return player.partnerZone.cards[0];
			}
			case "manaGainAmount": {
				return player.values.current.manaGainAmount;
			}
			case "standardDrawAmount": {
				return player.values.current.standardDrawAmount;
			}
			case "needsToPayForPartner": {
				return player.values.current.needsToPayForPartner;
			}
		}
	}
}

export class VariableNode extends AstNode {
	constructor(name, returnType) {
		super(returnType);
		this.name = name;
	}
	* eval(ctx) {
		let variable = ctx.ability.scriptVariables[this.name];
		if (variable === undefined) {
			throw new Error("Tried to access unitialized variable '" + this.name + "'.");
		}
		return new ScriptValue(variable.type, variable.get(ctx.player));
	}
}

export class ValueArrayNode extends AstNode {
	constructor(values, returnType) {
		super(returnType);
		this.values = values;
	}
	* eval(ctx) {
		return new ScriptValue(this.returnType, this.values);
	}
}

export class AnyAmountNode extends AstNode {
	constructor() {
		super("number");
	}
	* eval(ctx) {
		return new ScriptValue("number", "any");
	}
}

export class AllTypesNode extends AstNode {
	constructor() {
		super("type");
	}
	* eval(ctx) {
		return new ScriptValue("type", ctx.game.config.allTypes);
	}
}

// Math and comparison operators with left and right operands
export class MathNode extends AstNode {
	constructor(leftSide, rightSide, returnType = null) {
		super(returnType); // return type is set later by the parser once it has consolidated the expression tree
		this.leftSide = leftSide;
		this.rightSide = rightSide;
	}
	* eval(ctx) {
		let left = (yield* this.leftSide.eval(ctx)).get(ctx.player);
		let right = (yield* this.rightSide.eval(ctx)).get(ctx.player);
		return new ScriptValue(this.returnType, this.doOperation(left, right));
	}
	evalFull(ctx) {
		let left = this.leftSide.evalFull(ctx).map(value => value.get(ctx.player));
		let right = this.rightSide.evalFull(ctx).map(value => value.get(ctx.player));
		let results = [];
		for (const leftValue of left) {
			for (const rightValue of right) {
				results.push(new ScriptValue(this.returnType, this.doOperation(leftValue, rightValue)));
			}
		}
		return results;
	}
	getChildNodes() {
		return [this.leftSide, this.rightSide];
	}

	doOperation(left, right) {}
}
export class DashMathNode extends MathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
}
export class PlusNode extends DashMathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		if (typeof left[0] == "number" && typeof right[0] == "number") {
			return [left[0] + right[0]];
		}
		// for non-number types this concatenates the two lists.
		return left.concat(right);
	}
}
export class MinusNode extends DashMathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		if (typeof left[0] == "number" && typeof right[0] == "number") {
			return [left[0] - right[0]];
		}
		// for non-number types this subtracts the right list from the left one.
		let outputList = [];
		for (let element of left) {
			if (!right.some(elem => equalityCompare(elem, element))) {
				outputList.push(element);
			}
		}
		return outputList;
	}
}
export class DotMathNode extends MathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
}
export class MultiplyNode extends DotMathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		if (typeof left[0] != "number" || typeof right[0] != "number") {
			return [NaN];
		}
		return [left[0] * right[0]];
	}
}
export class DivideNode extends DotMathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		if (typeof left[0] != "number" || typeof right[0] != "number") {
			return [NaN];
		}
		return [left[0] / right[0]];
	}
}
export class FloorDivideNode extends DotMathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		if (typeof left[0] != "number" || typeof right[0] != "number") {
			return [NaN];
		}
		return [Math.floor(left[0] / right[0])];
	}
}
export class ComparisonNode extends MathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide, "bool");
	}
}
export class EqualsNode extends ComparisonNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		for (let element of left) {
			if (right.some(elem => equalityCompare(elem, element))) {
				return true;
			}
		}
		return false;
	}
}
export class NotEqualsNode extends ComparisonNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		for (let element of left) {
			if (right.some(elem => equalityCompare(elem, element))) {
				return false;
			}
		}
		return true;
	}
}
export class GreaterThanNode extends ComparisonNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		for (let rightSide of right) {
			for (let leftSide of left) {
				if (leftSide > rightSide) {
					return true;
				}
			}
		}
		return false;
	}
}
export class LessThanNode extends ComparisonNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		for (let rightSide of right) {
			for (let leftSide of left) {
				if (leftSide < rightSide) {
					return true;
				}
			}
		}
		return false;
	}
}
export class LogicNode extends MathNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
}
export class AndNode extends LogicNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		return left && right;
	}
}
export class OrNode extends LogicNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right) {
		return left || right;
	}
}

// Unary operators
export class UnaryMinusNode extends AstNode {
	constructor(operand) {
		super("number");
		this.operand = operand;
	}
	* eval(ctx) {
		return (yield* this.operand.eval(ctx)).map(value => -value.get(ctx.player));
	}
	evalFull(ctx) {
		return this.operand.evalFull(ctx).map(values => new ScriptValue("number", values.get(ctx.player).map(value => -value)));
	}
	getChildNodes() {
		return [this.operand];
	}
}
export class UnaryNotNode extends AstNode {
	constructor(operand) {
		super("bool");
		this.operand = operand;
	}
	* eval(ctx) {
		return new ScriptValue("bool", !(yield* this.operand.eval(ctx)).get(ctx.player));
	}
	evalFull(ctx) {
		return this.operand.evalFull(ctx).map(value => new ScriptValue("bool", !value.get(ctx.player)));
	}
	getChildNodes() {
		return [this.operand];
	}
}

export class BoolNode extends AstNode {
	constructor(value) {
		super("bool");
		this.value = value == "yes";
	}
	* eval(ctx) {
		return new ScriptValue("bool", this.value);
	}
}

export class PlayerNode extends AstNode {
	constructor(playerKeyword) {
		super("player");
		this.playerKeyword = playerKeyword;
	}
	* eval(ctx) {
		// a card that is not in a zone belongs to its owner as it is in the process of being summoned/cast/deployed
		let you = ctx.card.currentOwner();
		switch(this.playerKeyword) {
			case "you":
				return new ScriptValue("player", [you]);
			case "opponent":
				return new ScriptValue("player", [you.next()]);
			case "both":
				return new ScriptValue("player", [...you.game.players]);
			case "own":
				return new ScriptValue("player", [ctx.player]);
		}
	}
}

export class ZoneNode extends AstNode {
	constructor(zoneIdentifier, playerNode) {
		super("zone");
		this.zoneIdentifier = zoneIdentifier;
		this.playerNode = playerNode;
	}
	* eval(ctx) {
		let player = ctx.player;
		if (this.playerNode) {
			player = (yield* this.playerNode.eval(ctx)).get(ctx.player)[0];
		}
		return new ScriptValue("zone", this.getZone(player));
	}
	evalFull(ctx) {
		let players;
		if (this.playerNode) {
			players = this.playerNode.evalFull(ctx).map(p => p.get(ctx.player));
		} else {
			players = [ctx.player];
		}
		return players.map(player => new ScriptValue("zone", this.getZone(player)));
	}
	getChildNodes() {
		return this.playerNode? [this.playerNode] : [];
	}

	getZone(player) {
		if (this.playerNode) {
			return ({
				field: [player.unitZone, player.spellItemZone, player.partnerZone],
				deck: [player.deckZone],
				discard: [player.discardPile],
				exile: [player.exileZone],
				hand: [player.handZone],
				unitZone: [player.unitZone],
				spellItemZone: [player.spellItemZone],
				partnerZone: [player.partnerZone]
			})[this.zoneIdentifier];
		}
		return ({
			field: [player.unitZone, player.spellItemZone, player.partnerZone, player.next().unitZone, player.next().spellItemZone, player.next().partnerZone],
			deck: [player.deckZone, player.next().deckZone],
			discard: [player.discardPile, player.next().discardPile],
			exile: [player.exileZone, player.next().exileZone],
			hand: [player.handZone, player.next().handZone],
			unitZone: [player.unitZone, player.next().unitZone],
			spellItemZone: [player.spellItemZone, player.next().spellItemZone],
			partnerZone: [player.partnerZone, player.next().partnerZone]
		})[this.zoneIdentifier];
	}
}
export class DeckPositionNode extends AstNode {
	constructor(playerNode, position) {
		super("zone");
		this.playerNode = playerNode;
		this.top = position === "deckTop";
	}
	* eval(ctx) {
		return new ScriptValue("zone", new DeckPosition((yield* this.playerNode.eval(ctx)).get(ctx.player).map(player => player.deckZone), this.top));
	}
	evalFull(ctx) {
		return this.playerNode.evalFull(ctx).map(p => new ScriptValue("zone", new DeckPosition(p.get(ctx.player).map(player => player.deckZone), this.top)));
	}
	getChildNodes() {
		return [this.playerNode];
	}
}

export class BlockNode extends AstNode {
	constructor(blockType) {
		super("block");
		this.blockType = blockType;
	}
	* eval(ctx) {
		return new ScriptValue("block", [this.blockType]);
	}
}
export class PhaseNode extends AstNode {
	constructor(playerNode, phaseIndicator) {
		super("phase");
		this.playerNode = playerNode;
		this.phaseIndicator = phaseIndicator;
	}
	* eval(ctx) {
		let phaseAfterPrefix = this.phaseIndicator[0].toUpperCase() + this.phaseIndicator.slice(1);
		if (this.playerNode) {
			let prefix = ctx.player === (yield* this.playerNode.eval(ctx)).get(ctx.player)[0]? "your" : "opponent";
			return new ScriptValue("phase", [prefix + phaseAfterPrefix]);
		}
		return new ScriptValue("phase", ["your" + phaseAfterPrefix, "opponent" + phaseAfterPrefix]);
	}
}
export class TurnNode extends AstNode {
	constructor(playerNode) {
		super("turn");
		this.playerNode = playerNode;
	}
	* eval(ctx) {
		if (ctx.player === (yield* this.playerNode.eval(ctx)).get(ctx.player)[0]) {
			return new ScriptValue("turn", ["yourTurn"]);
		}
		return new ScriptValue("turn", ["opponentTurn"]);
	}
}
export class CurrentBlockNode extends AstNode {
	constructor() {
		super("block");
	}
	* eval(ctx) {
		let type = ctx.game.currentBlock()?.type;
		return new ScriptValue("block", type? [type] : []);
	}
}
export class CurrentPhaseNode extends AstNode {
	constructor() {
		super("phase");
	}
	* eval(ctx) {
		let phaseTypes = [...ctx.game.currentPhase().types];
		let prefix = ctx.player === game.currentTurn().player? "your" : "opponent";
		for (let i = phaseTypes.length -1; i >= 0; i--) {
			phaseTypes.push(prefix + phaseTypes[i][0].toUpperCase() + phaseTypes[i].slice(1));
		}
		return new ScriptValue("phase", phaseTypes);
	}
}
export class CurrentTurnNode extends AstNode {
	constructor() {
		super("turn");
	}
	* eval(ctx) {
		return new ScriptValue("turn", [ctx.player == ctx.game.currentTurn().player? "yourTurn" : "opponentTurn"]);
	}
}

// for the action accessor; pushes card to array if it is not in there yet.
function pushCardUnique(array, card) {
	if (array.findIndex(c => c.globalId === card.globalId) === -1) {
		array.push(card);
	}
}
export class ActionAccessorNode extends AstNode {
	constructor(actionsNode, accessor, actionProperties) {
		super({
			"cast": "card",
			"chosenTarget": "card",
			"declared": "card",
			"deployed": "card",
			"destroyed": "card",
			"discarded": "card",
			"exiled": "card",
			"moved": "card",
			"retired": "card",
			"summoned": "card",
			"targeted": "card",
			"viewed": "card"
		}[accessor]);
		this.actionsNode = actionsNode;
		this.accessor = accessor;
		this.actionProperties = actionProperties;
	}
	* eval(ctx) {
		const values = [];
		let actionList;
		if (this.actionsNode instanceof CurrentTurnNode) {
			actionList = game.currentTurn().getActions();
		} else {
			actionList = (yield* this.actionsNode.eval(ctx)).get(ctx.player);
		}
		for (const action of actionList) {
			if (action.isCancelled) continue;
			const actionCards = this.getActionValues(action);
			let hasProperties = true;
			setImplicit(actionCards, "card");
			for (const property of Object.keys(this.actionProperties)) {
				if (!(property in action.properties) ||
					!action.properties[property].equals(yield* this.actionProperties[property].eval(ctx), ctx.player)
				) {
					hasProperties = false;
					break;
				}
			}
			clearImplicit("card");
			if (!hasProperties) continue;

			for (const card of actionCards) {
				pushCardUnique(values, card);
			}
		}
		return new ScriptValue("card", values);
	}

	getActionValues(action) {
		switch (this.accessor) {
			case "cast": {
				if (action instanceof actions.Cast) {
					return [action.card];
				}
				break;
			}
			case "chosenTarget": {
				if (action instanceof actions.EstablishAttackDeclaration) {
					return [action.attackTarget];
				}
				break;
			}
			case "declared": {
				if (action instanceof actions.EstablishAttackDeclaration) {
					return action.attackers;
				}
				break;
			}
			case "deployed": {
				if (action instanceof actions.Deploy) {
					return [action.card];
				}
				break;
			}
			case "destroyed": {
				if (action instanceof actions.Destroy) {
					return [action.discard.card];
				}
				break;
			}
			case "discarded": {
				if (action instanceof actions.Discard) {
					return [action.card];
				}
				break;
			}
			case "exiled": {
				if (action instanceof actions.Exile) {
					return [action.card];
				}
				break;
			}
			case "moved": {
				if (action instanceof actions.Move) {
					return [action.card];
				}
				break;
			}
			case "retired": {
				if (action instanceof actions.Discard && action.properties.dueTo.get().includes("retire")) {
					return [action.card];
				}
				break;
			}
			case "viewed": {
				if (action instanceof actions.View) {
					return [action.card];
				}
				break;
			}
			case "summoned": {
				if (action instanceof actions.Summon) {
					return [action.card];
				}
				break;
			}
			case "targeted": {
				if (action instanceof actions.EstablishAttackDeclaration) {
					return [action.attackTarget];
				} else if (action instanceof actions.SetAttackTarget) {
					return [action.newTarget];
				}
				break;
			}
		}
		return [];
	}
}

export class ModifierNode extends AstNode {
	constructor(modifications) {
		super("modifier");
		this.modifications = modifications;
	}
	* eval(ctx) {
		return new ScriptValue("modifier", new Modifier(this.modifications, ctx));
	}
}

export class UntilIndicatorNode extends AstNode {
	constructor(until) {
		super("untilIndicator");
		this.until = until;
	}
	* eval(ctx) {
		return new ScriptValue("untilIndicator", this.until);
	}
}

// Functions must be initialized at the end so that all nodes are defined to be used as default values.
initFunctions();