// This module exports the definition for all nodes required for the CDF Script abstract syntax tree

import * as actions from "../actions.mjs";
import * as blocks from "../blocks.mjs";
import * as requests from "../inputRequests.mjs";
import {BaseCard} from "../card.mjs";
import {Modifier} from "../valueModifiers.mjs";
import {ScriptValue, ScriptContext, DeckPosition, SomeOrMore, UntilIndicator, TurnValue} from "./structs.mjs";
import {functions, initFunctions} from "./functions.mjs";
import {cartesianProduct} from "../math.mjs";

// these are the only types of which implicits currently get set and read.
const implicit = {
	card: [[]],
	action: [[]],
	player: [[]],
	fight: [[]]
}

// helper functions
function equalityCompare(a, b) {
	if (a instanceof BaseCard && b instanceof BaseCard) {
		return a.globalId === b.globalId;
	}
	return a === b;
}

// these intentionally error when implicit[type] is undefined
export function setImplicit(objects, type) {
	implicit[type].push(objects);
}
export function clearImplicit(type) {
	implicit[type].pop();
}

// matches a value against an expression, either directly or by making it an implicit and checking for the bool return value
function* directOrImplicitBoolCompare(ctx, expr, scriptValue) {
	if (scriptValue.type === expr.returnType) {
		// the value should be compared for equality with what the expression returns
		return scriptValue.equals(yield* expr.eval(ctx), ctx.player);
	} else if (expr.returnType === "bool") {
		// the value should be implicit and matches if the given expression is true
		setImplicit(scriptValue.get(ctx.player), scriptValue.type);
		const retVal = (yield* expr.eval(ctx)).get(ctx.player);
		clearImplicit(scriptValue.type);
		return retVal;
	}
	throw new Error(`Tried to match a ${scriptValue.type} value against a ${expr.returnType} expression.`);
}

class AstNode {
	constructor(returnType) {
		this.returnType = returnType; // null indicates no return type
	}

	* eval(ctx) {}
	// evalFull() does the same as eval without yielding any requests to the player.
	// It instead yields every result for every possible combination of choices that the player could make.
	// If run with an evaluatingPlayer, information that is hidden from that player is ignored.
	// This means that card matchers, for example, will always return hidden cards, no matter if they actually match.
	* evalFull(ctx) {
		let generator = this.eval(ctx);
		let next;
		do {
			next = generator.next();
		} while (!next.done);
		yield next.value;
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

// This serves as the root node of a card's script body or any block scoped lines
export class ScriptRootNode extends AstNode {
	constructor(lines) {
		super(null);
		this.lines = lines;
	}
	* eval(ctx) {
		for (let line of this.lines) {
			yield* line.eval(ctx);
		}
	}
	// whether or not all actions in this tree have enough targets to specify the target availability rule.
	hasAllTargets(ctx) {
		return this.hasAllTargetsFromLine(0, ctx);
	}
	getChildNodes() {
		return this.lines;
	}

	hasAllTargetsFromLine(i, ctx) {
		for (; i < this.lines.length; i++) {
			if (!this.lines[i].hasAllTargets(ctx)) {
				return false;
			}
			// If this line is a variable assignment, we need to enumerate all possible values
			// of the right-hand expression (as it may depend on player choice) and then
			// check target availability for the rest of the script with those choices made.
			// If just one of those branches has all targets, the ability is said to have all targets.
			if (this.lines[i].assignTo) {
				let oldVarValue = ctx.ability.scriptVariables[this.lines[i].assignTo];
				let foundValidBranch = false;
				for (const possibility of this.lines[i].evalFull(ctx)) {
					ctx.ability.scriptVariables[this.lines[i].assignTo] = possibility;
					if (this.hasAllTargetsFromLine(i + 1, ctx)) {
						foundValidBranch = true;
						break;
					}
				}
				ctx.ability.scriptVariables[this.lines[i].assignTo] = oldVarValue;
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
	* evalFull(ctx) {
		yield* this.expression.evalFull(ctx);
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
		const players = (yield* this.player.eval(ctx)).get(ctx.player);
		if (players.length == 1) {
			const value = yield* this.function.run(this, new ScriptContext(ctx.card, players[0], ctx.ability, ctx.evaluatingPlayer, ctx.targets));
			if (!this.function.returnType) return;
			return value;
		}
		// otherwise this is a both.FUNCTION() and must create a split value, while executing for the turn player first
		players.unshift(players.splice(players.indexOf(ctx.game.currentTurn().player), 1)[0]);
		let valueMap = new Map();
		let type;
		for (const player of players) {
			const value = yield* this.function.run(this, new ScriptContext(ctx.card, player, ctx.ability, ctx.evaluatingPlayer, ctx.targets));
			if (this.function.returnType) {
				type = value.type;
				valueMap.set(player, value.get(player));
			}
		}

		if (this.function.returnType) {
			return new ScriptValue(type, valueMap);
		}
	}
	* evalFull(ctx) {
		const players = this.player.evalFull(ctx).next().value.get(ctx.player);
		if (players.length === 1) {
			const results =
				this.function.runFull?.(this, new ScriptContext(ctx.card, players[0], ctx.ability, ctx.evaluatingPlayer, ctx.targets)) ??
				super.evalFull(new ScriptContext(ctx.card, players[0], ctx.ability, ctx.evaluatingPlayer, ctx.targets));
			for (const output of results) {
				if (output.type === "tempActions") { // actions need to be executed
					yield new ScriptValue(
						this.function.returnType,
						output.get(ctx.player).filter(val => val !== undefined).flat()
					);
				}
				yield output;
			}
		}
		// otherwise this is a both.FUNCTION() and must create split values, while executing for the turn player first
		players.unshift(players.splice(players.indexOf(ctx.game.currentTurn().player), 1)[0]);

		// iterates over the cartesian product of the function's runFull generators.
		for (const list of cartesianProduct(
			players.map(
				player => this.function.runFull?.(this, new ScriptContext(ctx.card, player, ctx.ability, ctx.evaluatingPlayer, ctx.targets))
			)
		)) {
			const valueMap = new Map();
			for (let i = 0; i < list.length; i++) {
				valueMap.set(
					players[i],
					list[i].get(players[i]).filter(val => val !== undefined).flat()
				);
			}
			yield new ScriptValue(this.function.returnType, valueMap);
		}
	}
	hasAllTargets(ctx) {
		let players = this.player.evalFull(ctx).next().value.get(ctx.player);
		for (const player of players) {
			let context = new ScriptContext(ctx.card, player, ctx.ability, ctx.evaluatingPlayer, ctx.targets);
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

export class ObjectMatchNode extends AstNode {
	constructor(objectNodes, conditions) {
		let returnType = objectNodes[0].returnType;
		if (returnType === "zone") returnType = "card";
		super(returnType);
		this.objectNodes = objectNodes;
		this.conditions = conditions;
	}
	* eval(ctx) {
		return new ScriptValue("card", yield* this.getMatchingCards(ctx));
	}
	* evalFull(ctx) {
		let generator = this.getMatchingCards(ctx);
		let next;
		do {
			next = generator.next();
		} while (!next.done);
		yield new ScriptValue("card", next.value);
	}
	getChildNodes() {
		return this.objectNodes.concat(this.conditions);
	}

	* getMatchingCards(ctx) {
		const objects = [];
		const matchingObjects = [];
		for (const objectNode of this.objectNodes) {
			const objectList = (yield* objectNode.eval(ctx)).get(ctx.player);
			switch (objectNode.returnType) {
				case "card":
				case "fight": {
					objects.push(...objectList);
					break;
				}
				case "zone": {
					objects.push(...(objectList.map(zone => zone.cards).flat()));
					break;
				}
			}
		}
		for (const checkObj of objects) {
			if (checkObj === null) continue;

			// If this is for cards and the evaluating player can't see the cards, they should all be treated as valid / matching.
			if (checkObj instanceof BaseCard && checkObj.hiddenFor.includes(ctx.evaluatingPlayer) && checkObj.zone !== ctx.evaluatingPlayer.deckZone) {
				matchingObjects.push(checkObj);
				continue;
			}
			setImplicit([checkObj], this.returnType);
			if ((!this.conditions || (yield* this.conditions.eval(ctx)).get(ctx.player))) {
				matchingObjects.push(checkObj);
				clearImplicit(this.returnType);
				continue;
			}
			clearImplicit(this.returnType);
		}
		return matchingObjects;
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
		if (ctx.game.currentAttackDeclaration?.isValid() && ctx.game.currentAttackDeclaration?.target) {
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
		if (ctx.game.currentAttackDeclaration?.isValid()) {
			return new ScriptValue("card", [...ctx.game.currentAttackDeclaration.attackers]);
		}
		return new ScriptValue("card", []);
	}
}

export class FightsNode extends AstNode {
	constructor() {
		super("fight");
	}
	* eval(ctx) {
		const block = ctx.game.currentBlock();
		if (block instanceof blocks.Fight) {
			return new ScriptValue("fight", [block.fight]);
		}
		return new ScriptValue("fight", []);
	}
}

export class ImplicitValuesNode extends AstNode {
	constructor(returnType) {
		super(returnType);
	}
	* eval(ctx) {
		return new ScriptValue(this.returnType, implicit[this.returnType].at(-1));
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

	* evalFull(ctx) {
		for (const possibility of this.cards.evalFull(ctx)) {
			yield new ScriptValue(this.returnType, possibility.get(ctx.player).map(card => this.accessProperty(card)).flat());
		}
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
				return card.attacksMadeThisTurn;
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

	* evalFull(ctx) {
		for (const possibility of this.players.evalFull(ctx)) {
			yield new ScriptValue(this.returnType, possibility.get(ctx.player).map(player => this.accessProperty(player)).flat());
		}
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
export class FightPropertyNode extends AstNode {
	constructor(fights, property) {
		super({
			counterattackFirst: "bool",
			dealDamageTo: "player",
			participants: "card",
			opponentLifeDamage: "number",
			yourLifeDamage: "number"
		}[property]);
		this.fights = fights;
		this.property = property;
	}

	* eval(ctx) {
		const fights = (yield* this.fights.eval(ctx)).get(ctx.player);
		let retVal = fights.map(fight => this.accessProperty(fight, ctx)).flat();
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

	* evalFull(ctx) {
		for (const possibility of this.players.evalFull(ctx)) {
			yield new ScriptValue(this.returnType, possibility.get(ctx.player).map(player => this.accessProperty(player)).flat());
		}
	}

	getChildNodes() {
		return [this.fights];
	}

	accessProperty(fight, ctx) {
		switch(this.property) {
			case "counterattackFirst": {
				return fight.counterattackFirst;
			}
			case "dealDamageTo": {
				return fight.dealDamageTo;
			}
			case "participants": {
				return fight.attackers.concat([fight.target]);
			}
			// TODO: unset life damage overrides should calculate the base amount
			//       (maybe that should just get calculated as the initial value?)
			case "opponentLifeDamage": {
				return fight.lifeDamageOverrides.get(ctx.player.next()) ?? 0;
			}
			case "yourLifeDamage": {
				return fight.lifeDamageOverrides.get(ctx.player) ?? 0;
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
			throw new Error(`Tried to access unitialized variable '${this.name}'.`);
		}
		return new ScriptValue(variable.type, variable.get(ctx.player));
	}
}

export class ValueNode extends AstNode {
	constructor(values, returnType) {
		super(returnType);
		this.values = values;
	}
	* eval(ctx) {
		return new ScriptValue(this.returnType, this.values);
	}
}
// Yes, all values are arrays but a ValueNode can only hold direct objects while an ArrayNode can hold expressions.
// This is strictly required for things like arrays of zones which are always ZoneNodes, not ValueNodes.
export class ArrayNode extends AstNode {
	constructor(valueNodes, returnType) {
		super(returnType);
		this.valueNodes = valueNodes;
	}
	* eval(ctx) {
		const values = [];
		for (const node of this.valueNodes) {
			values.push((yield* node.eval(ctx)).get(ctx.player));
		}
		return new ScriptValue(this.returnType, values.flat(1));
	}

	getChildNodes() {
		return this.valueNodes;
	}
}

export class SomeOrMoreNode extends AstNode {
	constructor(min) {
		super("number");
		this.min = min;
	}
	* eval(ctx) {
		return new ScriptValue("number", new SomeOrMore(this.min));
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
		const left = (yield* this.leftSide.eval(ctx));
		const right = (yield* this.rightSide.eval(ctx));
		return new ScriptValue(this.returnType, this.doOperation(left, right, ctx.player));
	}
	* evalFull(ctx) {
		for (const left of this.leftSide.evalFull(ctx)) {
			for (const right of this.rightSide.evalFull(ctx)) {
				yield new ScriptValue(this.returnType, this.doOperation(left, right, ctx.player));
			}
		}
	}
	getChildNodes() {
		return [this.leftSide, this.rightSide];
	}

	doOperation(left, right, player) {}
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
	doOperation(left, right, player) {
		left = left.get(player);
		right = right.get(player);
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
	doOperation(left, right, player) {
		left = left.get(player);
		right = right.get(player);
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
	doOperation(left, right, player) {
		left = left.get(player);
		right = right.get(player);
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
	doOperation(left, right, player) {
		left = left.get(player);
		right = right.get(player);
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
	doOperation(left, right, player) {
		left = left.get(player);
		right = right.get(player);
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
	doOperation(left, right, player) {
		return left.equals(right, player);
	}
}
export class NotEqualsNode extends ComparisonNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right, player) {
		return left.notEquals(right, player);
	}
}
export class GreaterThanNode extends ComparisonNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right, player) {
		left = left.get(player);
		right = right.get(player);
		for (const rightSide of right) {
			for (const leftSide of left) {
				if (leftSide > rightSide) {
					return true;
				}
			}
		}
		return false;
	}
}
export class GreaterEqualsNode extends ComparisonNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right, player) {
		left = left.get(player);
		right = right.get(player);
		for (const rightSide of right) {
			for (const leftSide of left) {
				if (leftSide >= rightSide) {
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
	doOperation(left, right, player) {
		left = left.get(player);
		right = right.get(player);
		for (const rightSide of right) {
			for (const leftSide of left) {
				if (leftSide < rightSide) {
					return true;
				}
			}
		}
		return false;
	}
}
export class LessEqualsNode extends ComparisonNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right, player) {
		left = left.get(player);
		right = right.get(player);
		for (const rightSide of right) {
			for (const leftSide of left) {
				if (leftSide <= rightSide) {
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
	doOperation(left, right, player) {
		left = left.get(player);
		right = right.get(player);
		return left && right;
	}
}
export class OrNode extends LogicNode {
	constructor(leftSide, rightSide) {
		super(leftSide, rightSide);
	}
	doOperation(left, right, player) {
		left = left.get(player);
		right = right.get(player);
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
		return new ScriptValue("number", (yield* this.operand.eval(ctx).get(ctx.player)).map(value => -value));
	}
	* evalFull(ctx) {
		for (const values of this.operand.evalFull(ctx)) {
			yield new ScriptValue("number", values.get(ctx.player).map(value => -value));
		}
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
		return new ScriptValue("bool", !(yield* this.operand.eval(ctx)).get(ctx.player)[0]);
	}
	* evalFull(ctx) {
		for (const value of this.operand.evalFull(ctx)) {
			yield new ScriptValue("bool", !value.get(ctx.player))
		}
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
		const you = ctx.card.currentOwner();
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
	* evalFull(ctx) {
		if (!this.playerNode) {
			yield new ScriptValue("zone", this.getZone(ctx.player));
			return;
		}

		for (const player of this.playerNode.evalFull(ctx)) {
			yield new ScriptValue("zone", this.getZone(player.get(ctx.player)));
		}
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
		return new ScriptValue("zone", (yield* this.playerNode.eval(ctx)).get(ctx.player).map(player => new DeckPosition(player.deckZone, this.top)));
	}
	* evalFull(ctx) {
		for (const player of this.playerNode.evalFull(ctx)) {
			yield new ScriptValue("zone", player.get(ctx.player).map(player => new DeckPosition(player.deckZone, this.top)));
		}
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
	constructor(playerNode, next) {
		super("turn");
		this.playerNode = playerNode;
		this.next = next;
	}
	* eval(ctx) {
		const players = (yield* this.playerNode.eval(ctx)).get(ctx.player);
		const turns = [];
		for (const player of players) {
			turns.push(new TurnValue(player, this.next));
		}
		if (players.length === 0) {
			turns.push(new TurnValue(null, this.next));
		}
		return new ScriptValue("turn", turns);
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
		let prefix = ctx.player === ctx.game.currentTurn().player? "your" : "opponent";
		for (let i = phaseTypes.length -1; i >= 0; i--) {
			phaseTypes.push(prefix + phaseTypes[i][0].toUpperCase() + phaseTypes[i].slice(1));
		}
		return new ScriptValue("phase", phaseTypes);
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
			"viewed": "card",

			"lifeGained": "number",
			"lifeLost": "number",
			"manaGained": "number",
			"manaLost": "number"
		}[accessor]);
		this.actionsNode = actionsNode;
		this.accessor = accessor;
		this.actionProperties = actionProperties;
	}
	* eval(ctx) {
		const values = [];
		let actionList = (yield* this.actionsNode.eval(ctx)).get(ctx.player);
		if (this.actionsNode instanceof TurnNode) {
			actionList = actionList.map(turn => ctx.game.turns[turn.getIndex(ctx.game)]?.getActions() ?? []).flat(1);
		}
		for (const action of actionList) {
			if (action.isCancelled) continue;
			let propertiesMatch = true;
			for (const property of Object.keys(this.actionProperties)) {
				// if property doesn't exist, it doesn't match
				if (typeof action.properties[property] === "undefined") {
					propertiesMatch = false;
					break;
				}
				// check if property matches
				if (!directOrImplicitBoolCompare(ctx, this.actionProperties[property], action.properties[property])) {
					propertiesMatch = false;
					break;
				}
			}
			if (!propertiesMatch) continue;

			for (const value of this.getActionValues(action)) {
				if (this.returnType === "card") {
					pushCardUnique(values, value);
				} else {
					values.push(value);
				}
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

			// number values
			case "damageDealt": {
				if (action instanceof actions.DealDamage) {
					return [action.amount];
				}
				break;
			}
			case "lifeGained": {
				if (action instanceof actions.GainLife) {
					return [action.amount];
				}
				break;
			}
			case "lifeLost": {
				if (action instanceof actions.LoseLife) {
					return [action.amount];
				}
				break;
			}
			case "manaGained": {
				if (action instanceof actions.GainMana) {
					return [action.amount];
				}
				break;
			}
			case "manaLost": {
				if (action instanceof actions.LoseMana) {
					return [action.amount];
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

export class ForeverNode extends AstNode {
	constructor() {
		super("untilIndicator");
	}
	* eval(ctx) {
		return new ScriptValue("untilIndicator", [new UntilIndicator("forever")]);
	}
}
// returns the earliest of the provided turns
function earliest(turns, game) {
	let earliest;
	let earliestIndex = Infinity;
	for (const turn of turns) {
		const turnIndex = turn.getIndex(game);
		if (turnIndex < earliestIndex) {
			earliest = turn;
			earliestIndex = turnIndex;
		}
	}
	return earliest;
}
export class UntilEndOfTurnNode extends AstNode {
	constructor(turnNode) {
		super("untilIndicator");
		this.turnNode = turnNode;
	}
	* eval(ctx) {
		return new ScriptValue(
			"untilIndicator",
			[new UntilIndicator(
				"endOfTurn",
				earliest((yield* this.turnNode.eval(ctx)).get(ctx.player), ctx.game)
			)]
		);
	}
}
export class UntilPhaseNode extends AstNode {
	constructor(turnNode, phaseType) {
		super("untilIndicator");
		this.turnNode = turnNode;
		this.phaseType = phaseType;
	}
	* eval(ctx) {
		return new ScriptValue(
			"untilIndicator",
			[new UntilIndicator(
				"phase",
				earliest((yield* this.turnNode.eval(ctx)).get(ctx.player), ctx.game),
				this.phaseType
			)]
		);
	}
}

export class MayBlockNode extends AstNode {
	constructor(playerNode, rootNode) {
		super(null);
		this.playerNode = playerNode;
		this.rootNode = rootNode;
	}
	* eval(ctx) {
		// TODO: figure out how a both.may needs to work
		const player = (yield* this.playerNode.eval(ctx)).get(ctx.player)[0];

		const optionalRequest = new requests.DoOptionalEffectSection(ctx.player, ctx.ability, this.rootNode);
		if (optionalRequest.extractResponseValue(yield [optionalRequest])) {
			yield* this.rootNode.eval(new ScriptContext(ctx.card, player, ctx.ability, ctx.evaluatingPlayer, ctx.targets));
		}
	}
	hasAllTargets(ctx) {
		return true;
	}
	getChildNodes() {
		return [this.rootNode];
	}
}

// Functions must be initialized at the end so that all nodes are defined to be used as default values.
initFunctions();