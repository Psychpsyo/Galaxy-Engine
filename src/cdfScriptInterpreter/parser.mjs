// TODO: forgetting the semicolon in a replace modifier's replacement can give
// weird error message as it seems to consume too many tokens.
// Script to replicate:
// SUMMON(SELECT(1, [from you.hand]), {replace manaLost > 0 with LOSEMANA(manaLost * 2) });

import * as ast from "./astNodes.mjs";
import * as valueModifiers from "../valueModifiers.mjs";

let code; // the actual text representation of the code being parsed
let tokens; // the token stream emitted by the lexer
let pos; // the current position in the token stream
let parseType; // The type of the script that is currently being parsed.
let effectId; // The effect that is currently being parsed.
let cardId; // the card the effect is on

// contains a list of objects holding variable definition types, indexed by the IDs of what effects they appear in, like so:
// {
// 	"CUU00161:1": {
// 		"$units": "card"
// 	}
// }
export const variableTypes = {};
// for each effect ID, this holds a list of what variables are captured in it, like so:
// {
// 	"CUU00027:1": ["$cards"]
// }
export const capturedVariables = {};

export class ScriptParserError extends Error {
	constructor(message, startToken, endToken = startToken) {
		// generate error message
		message += " (on " + effectId + ")\n";
		const lines = code.split("\n");
		const maxLineNumberLenght = endToken.line.toString().length;
		for (let i = startToken.line; i <= endToken.line; i++) {
			message += "\n" + i.toString().padStart(maxLineNumberLenght) + ": " + lines[i];
			let lineIndent = "";
			while ([" ", "\t"].includes(lines[i][lineIndent.length])) lineIndent += lines[i][lineIndent.length];
			const startColumn = i === startToken.line? startToken.column - lineIndent.length : 0;
			const endColumn = (i === endToken.line? endToken.column + endToken.value.length : lines[i].length) - lineIndent.length;
			message += "\n" + " ".repeat(maxLineNumberLenght + 2) + lineIndent + " ".repeat(startColumn) + "^".repeat(endColumn - startColumn);
		}

		super(message);
		this.name = "ScriptParserError";
		this.cardId = cardId;
		this.effectId = effectId;
	}
}

export function parseScript(tokenList, newEffectId, type, originalCodeString) {
	if (tokenList.length == 0) {
		return null;
	}
	code = originalCodeString;
	parseType = type;
	effectId = newEffectId;
	cardId = effectId.substring(0, effectId.indexOf(":"));
	tokens = tokenList;
	pos = 0;

	switch (type) {
		case "applyTarget":
		case "cardCondition":
		case "cardTurnLimit":
		case "condition":
		case "during":
		case "equipableTo":
		case "forPlayer":
		case "gameLimit":
		case "globalTurnLimit":
		case "triggerPrecondition":
		case "turnLimit":
		case "zoneDurationLimit": {
			// TODO: check expression return value type
			return parseExpression();
		}
		case "trigger": {
			return new ast.TriggerRootNode(parseExpression());
		}
		case "modifier": {
			// for static abilities
			return parseModifier(true);
		}
		default: {
			return parseLines();
		}
	}
}

function parseLines() {
	let lines = [];
	while(pos < tokens.length) {
		switch (tokens[pos].type) {
			case "newLine": {
				pos++;
				break;
			}
			case "rightBrace": {
				return new ast.ScriptRootNode(lines);
			}
			default: {
				const lineStart = tokens[pos];
				lines.push(parseLine());
				if (tokens[pos]?.type !== "newLine") {
					throw new ScriptParserError("Line in a script does not end with semicolon.", lineStart, tokens[pos - 1]);
				}
				break;
			}
		}
	}
	return new ast.ScriptRootNode(lines);
}

function parseLine() {
	let variableName = null;
	const lineStartPos = pos;
	switch (tokens[pos].type) {
		case "if": {
			return new ast.LineNode(parseIfStatement(), null);
		}
		case "try": {
			return new ast.LineNode(parseOptionalSection(null), null);
		}
		case "at": {
			return new ast.LineNode(parseAtStatement(), null);
		}
		case "variable": {
			if (tokens[pos+1].type === "equals") {
				variableName = tokens[pos].value;
				pos += 2;
			}
			break;
		}
	}
	const expression = parseExpression();
	// check variable type
	if (variableName) {
		variableTypes[effectId] ??= {};
		if (!variableTypes[effectId][variableName]) {
			variableTypes[effectId][variableName] = expression.returnType;
		} else {
			if (variableTypes[effectId][variableName] !== expression.returnType) {
				throw new ScriptParserError(`Invalid assignment of type ${expression.returnType} to variable ${variableName} of type ${variableTypes[effectId][variableName]}.`, tokens[lineStartPos], tokens[lineStartPos + 1]);
			}
			if (capturedVariables[effectId]?.includes(variableName)) {
				throw new ScriptParserError("Captured variables cannot be written to manually.", tokens[lineStartPos], tokens[lineStartPos + 1]);
			}
		}
	}
	return new ast.LineNode(expression, variableName);
}

function parseFunction() {
	let player;
	switch (tokens[pos].type) {
		case "function": {
			player = new ast.PlayerNode("own");
			break;
		}
		case "player": {
			player = parsePlayer();
			if (tokens[pos].type != "dotOperator" || tokens[pos+1].type != "function") {
				throw new ScriptParserError("Expected a function call here.", tokens[pos]);
			}
			pos++;
			break;
		}
		case "variable": {
			player = parseVariable();
			if (tokens[pos].type != "dotOperator" || tokens[pos+1].type != "function") {
				throw new ScriptParserError("Expected a function call here.", tokens[pos]);
			}
			pos++;
			break;
		}
		default: {
			throw new ScriptParserError("Expected a function call here.", tokens[pos]);
		}
	}

	return parseFunctionToken(player);
}

function parseFunctionToken(player) {
	let functionName = tokens[pos].value;
	pos++;

	let asManyAsPossible = false;
	if (tokens[pos].type == "asmapOperator") {
		asManyAsPossible = true;
		pos++;
	}

	if (tokens[pos].type != "leftParen") {
		throw new ScriptParserError("'" + functionName + "' must be followed by a '('.", tokens[pos]);
	}
	pos++;

	let parameters = [];
	while (tokens[pos].type != "rightParen") {
		parameters.push(parseExpression());
		if (tokens[pos].type == "separator") {
			pos++;
		}
	}
	pos++;

	return new ast.FunctionNode(functionName, parameters, player, asManyAsPossible);
}

const expressionStops = ["rightParen", "rightBracket", "rightBrace", "newLine", "separator", "if", "with", "where"];
function parseExpression() {
	const expressionStartPos = pos;
	let expression = [];
	let operatorMetadata = [];
	while (tokens[pos] && !expressionStops.includes(tokens[pos].type)) {
		expression.push(parseValue());
		opLoop: while(tokens[pos]) {
			switch (tokens[pos].type) {
				case "plus": {
					expression.push(new ast.PlusNode(null, null));
					break;
				}
				case "minus": {
					expression.push(new ast.MinusNode(null, null));
					break;
				}
				case "multiply": {
					expression.push(new ast.MultiplyNode(null, null));
					break;
				}
				case "divide": {
					expression.push(new ast.DivideNode(null, null));
					break;
				}
				case "floorDivide": {
					expression.push(new ast.FloorDivideNode(null, null));
					break;
				}
				case "tilde": {
					expression.push(new ast.RangeNode(null, null));
					break;
				}
				case "equals": {
					expression.push(new ast.EqualsNode(null, null));
					break;
				}
				case "notEquals": {
					expression.push(new ast.NotEqualsNode(null, null));
					break;
				}
				case "greaterThan": {
					expression.push(new ast.GreaterThanNode(null, null));
					break;
				}
				case "greaterEquals": {
					expression.push(new ast.GreaterEqualsNode(null, null));
					break;
				}
				case "lessThan": {
					expression.push(new ast.LessThanNode(null, null));
					break;
				}
				case "lessEquals": {
					expression.push(new ast.LessEqualsNode(null, null));
					break;
				}
				case "andOperator": {
					expression.push(new ast.AndNode(null, null));
					break;
				}
				case "orOperator": {
					expression.push(new ast.OrNode(null, null));
					break;
				}
				default: {
					break opLoop;
				}
			}
			operatorMetadata.push({startPos: pos, endPos: pos, node: expression.at(-1)});
			pos++;
		}
	}

	if (expression.length == 0) {
		return new ast.NullNode();
	}

	// consolidate 'X+' notation
	for (let i = 0; i < expression.length - 1; i++) {
		// singular numbers followed by a plus with only another math symbol after that get concatenated with the plus
		if ((expression[i] instanceof ast.ArrayNode || expression[i] instanceof ast.ValueNode) &&
			expression[i+1] instanceof ast.PlusNode &&
			expression[i].returnType === "number" &&
			(expression[i].valueNodes ?? expression[i].values).length === 1 &&
			(i === expression.length - 2 || expression[i+2] instanceof ast.MathNode)
		) {
			const nPlusValue = new ast.SomeOrMoreNode(
				(expression[i].valueNodes?.[0] ?? expression[i]).values[0]
			);
			const plus = expression.splice(i, 2, nPlusValue)[1];
			const plusIndex = operatorMetadata.findIndex(elem => elem.node === plus);
			operatorMetadata.splice(plusIndex, 1);
		}
	}

	// consolidate expression
	for (let type of [ast.RangeNode, ast.DotMathNode, ast.DashMathNode, ast.ComparisonNode, ast.LogicNode]) {
		for (let i = 1; i < expression.length - 1; i++) {
			if (expression.length < 3) break;
			if (expression[i] instanceof type && expression[i].leftSide === null && expression[i].rightSide === null) {
				expression[i].leftSide = expression[i-1];
				expression[i].rightSide = expression[i+1];
				i--;
				expression.splice(i, 3, expression[i+1]);
			}
		}
	}
	if (expression.length > 1) {
		throw new ScriptParserError("Failed to fully consolidate expression.", tokens[expressionStartPos], tokens[pos-1]);
	}
	// To figure out operator return types, we iterate them, assigning types as we go.
	// This might not be possible in a single pass, so we repeat as long as there is any left to assign.
	let missingReturnTypes = true;
	while (missingReturnTypes) {
		missingReturnTypes = false;
		for (const elem of operatorMetadata) {
			if (elem.node.returnType !== null) {
				continue;
			}
			elem.node.returnType = elem.node.leftSide.returnType ?? elem.node.rightSide.returnType;
			if (!elem.node.returnType) missingReturnTypes = true;
		}
	}
	// Now that we have all the return types, make sure that all operators are taking valid, identically-typed operands.
	for (const elem of operatorMetadata) {
		if (elem.node.leftSide.returnType !== elem.node.rightSide.returnType) {
			throw new ScriptParserError(`Operator cannot take differing operand types ${elem.node.leftSide.returnType} and ${elem.node.rightSide.returnType}.`, tokens[elem.startPos], tokens[elem.endPos]);
		}
		if (elem.node.constructor.invalidOperandTypes?.includes(elem.node.leftSide.returnType) ||
		   (elem.node.constructor.validOperandTypes && !elem.node.constructor.validOperandTypes.includes(elem.node.leftSide.returnType))
		) {
			throw new ScriptParserError(`Operator ${tokens[elem.startPos].value} cannot take operands of type ${elem.node.rightSide.returnType}.`, tokens[elem.startPos], tokens[elem.endPos]);
		}
	}
	return expression[0];
}

function parseValue() {
	switch (tokens[pos].type) {
		case "number": {
			return parseNumber();
		}
		case "anyAmount": {
			pos++;
			return new ast.SomeOrMoreNode(1);
		}
		case "allTypes": {
			pos++;
			return new ast.AllTypesNode();
		}
		case "allCardNames": {
			pos++;
			return new ast.AllCardNamesNode();
		}
		case "allUnitNames": {
			pos++;
			return new ast.AllUnitNamesNode();
		}
		case "allSpellNames": {
			pos++;
			return new ast.AllSpellNamesNode();
		}
		case "allItemNames": {
			pos++;
			return new ast.AllItemNamesNode();
		}
		case "minus": {
			pos++;
			return new ast.UnaryMinusNode(parseValue());
		}
		case "bang": {
			pos++;
			return new ast.UnaryNotNode(parseValue());
		}
		case "player": {
			const player = parsePlayer();
			if (tokens[pos] && tokens[pos].type === "dotOperator") {
				pos++;
				return parsePlayerDotAccess(player);
			}
			return player;
		}
		case "fights": {
			const node = new ast.FightsNode();
			pos++;
			if (tokens[pos] && tokens[pos].type === "dotOperator") {
				pos++;
				return parseFightDotAccess(node);
			}
			return node;
		}
		case "currentFight": {
			const node = new ast.CurrentFightNode();
			pos++;
			if (tokens[pos] && tokens[pos].type === "dotOperator") {
				pos++;
				return parseFightDotAccess(node);
			}
			return node;
		}
		case "leftBracket": {
			if (tokens[pos+1].type === "from") {
				let cardMatcher = parseCardMatcher();
				if (tokens[pos] && tokens[pos].type === "dotOperator") {
					pos++;
					return parseCardDotAccess(cardMatcher);
				}
				return cardMatcher;
			}
			return parseList();
		}
		case "function": {
			return parseFunction();
		}
		case "cardId":
		case "abilityId": {
			const node = new ast.ValueNode([tokens[pos].value.substring(2)], tokens[pos].type);
			pos++;
			return node;
		}
		case "cardType":
		case "counter":
		case "dueToReason":
		case "type": {
			const node = new ast.ValueNode([tokens[pos].value], tokens[pos].type);
			pos++;
			return node;
		}
		case "phaseType": {
			let node = new ast.PhaseNode(null, tokens[pos].value);
			pos++;
			return node;
		}
		case "blockType": {
			let node = new ast.BlockNode(tokens[pos].value);
			pos++;
			return node;
		}
		case "zone": {
			return parseZone();
		}
		case "deckPosition": {
			let node = new ast.DeckPositionNode(new ast.PlayerNode("both"), tokens[pos].value);
			pos++;
			return node;
		}
		case "bool": {
			return parseBool();
		}
		case "leftParen": {
			pos++;
			const node = parseExpression();
			if (tokens[pos].type == "rightParen") {
				pos++;
			} else {
				throw new ScriptParserError("Expected a ')' at the end of parenthesized expression value.", tokens[pos]);
			}
			return node;
		}
		case "variable": {
			// check for variable capturing syntax
			if (tokens[pos+1]?.type === "leftBrace") {
				if (parseType !== "trigger") {
					throw new ScriptParserError("Variable captures may only be used inside the 'after' of an effect.", tokens[pos], tokens[pos+1]);
				}
				const startPos = pos;
				const name = tokens[pos].value;
				pos += 2;
				const innerExpression = parseExpression();
				if (tokens[pos]?.type !== "rightBrace") {
					throw new ScriptParserError(`Expected a '}' here after the variable capture for ${variable.name}.`, tokens[pos]);
				}

				variableTypes[effectId] ??= {};
				if (!variableTypes[effectId][name]) {
					variableTypes[effectId][name] = innerExpression.returnType;
					capturedVariables[effectId] ??= [];
					capturedVariables[effectId].push(name);
				} else if (variableTypes[effectId][name] !== innerExpression.returnType) {
					throw new ScriptParserError(`Invalid variable capture of type ${innerExpression.returnType} for variable ${name} of type ${variableTypes[effectId][name]}.`, tokens[startPos], tokens[pos]);
				}

				pos++;
				return new ast.VariableCapture(name, innerExpression);
			}
			// otherwise, we're just using a variable
			const variable = parseVariable();
			if (tokens[pos] && tokens[pos].type === "dotOperator") {
				pos++;
				switch (tokens[pos].type) {
					case "phaseType":
					case "turn":
					case "function":
					case "deckPosition":
					case "playerProperty":
					case "may": // TODO: restrict this to the beginning of non-variable-assignment lines.
					case "zone": {
						return parsePlayerDotAccess(variable);
					}
					case "cardProperty": {
						return parseCardDotAccess(variable);
					}
					case "actionAccessor": {
						return parseActionAccessor(variable);
					}
					case "fightProperty": {
						return parseFightDotAccess(variable);
					}
					default: {
						throw new ScriptParserError(`'${tokens[pos].value}' does not start a valid variable property.`, tokens[pos]);
					}
				}
			}
			return variable;
		}
		case "thisCard":
		case "attackTarget":
		case "attackers": {
			let cards;
			switch (tokens[pos].type) {
				case "thisCard":
					cards = new ast.ThisCardNode();
					break;
				case "attackTarget":
					cards = new ast.AttackTargetNode();
					break;
				case "attackers":
					cards = new ast.AttackersNode();
					break;
			}
			pos++;
			if (tokens[pos] && tokens[pos].type == "dotOperator") {
				pos++;
				return parseCardDotAccess(cards);
			}
			return cards;
		}
		case "cardProperty": {
			return parseCardDotAccess(new ast.ImplicitValuesNode("card"));
		}
		case "playerProperty": {
			return parsePlayerDotAccess(new ast.ImplicitValuesNode("player"));
		}
		case "fightProperty": {
			return parseFightDotAccess(new ast.ImplicitValuesNode("fight"));
		}
		case "actionAccessor": {
			return parseActionAccessor(new ast.ImplicitValuesNode("action"));
		}
		case "currentBlock": {
			pos++;
			return new ast.CurrentBlockNode();
		}
		case "currentPhase": {
			pos++;
			return new ast.CurrentPhaseNode();
		}
		case "currentTurn": {
			const turn = new ast.TurnNode(new ast.ValueNode([], "player"), false);
			pos++;
			if (tokens[pos] && tokens[pos].type === "dotOperator") {
				pos++;
				return parseTurnDotAccess(turn);
			}
			return turn;
		}
		case "nextTurn": {
			const turn = new ast.TurnNode(new ast.ValueNode([], "player"), true);
			pos++;
			if (tokens[pos] && tokens[pos].type === "dotOperator") {
				pos++;
				return parseTurnDotAccess(turn);
			}
			return turn;
		}
		case "leftBrace": {
			return parseModifier();
		}
		case "forever": {
			let node = new ast.ForeverNode();
			pos++;
			return node;
		}
		default: {
			throw new ScriptParserError(`'${tokens[pos].value}' does not start a valid value.`, tokens[pos]);
		}
	}
}

function parseLineBlock(openingToken) {
	if (tokens[pos].type != "leftBrace") {
		throw new ScriptParserError(`Expected curly braces for block after '${openingToken.value}', but got '${tokens[pos].value}' instead.`, openingToken, tokens[pos]);
	}
	pos++;
	const lines = parseLines();
	if (tokens[pos].type != "rightBrace") {
		throw new ScriptParserError(`Missing a '}' at the end of this '${openingToken.value}' block.`, openingToken, tokens[pos] ?? tokens.at(-1));
	}
	pos++;
	return lines;
}
function parseIfStatement() {
	const ifToken = tokens[pos];
	pos++;
	if (tokens[pos]?.type !== "leftParen") {
		throw new ScriptParserError("Expected parenthesized expression after 'if'.", tokens[pos-1]);
	}
	const conditionStart = tokens[pos];
	pos++;
	const condition = parseExpression();
	if (tokens[pos]?.type !== "rightParen") {
		throw new ScriptParserError("Expected a ')' at the end of this expression." + (tokens[pos]? ` Found '${tokens[pos].value}' instead.` : ""), conditionStart, tokens[pos] ?? tokens.at(-1));
	}
	if (condition.returnType !== "bool") {
		throw new ScriptParserError(`An if-statement's condition must evaluate to a bool. This evaluates to a value of type '${condition.returnType}'`, conditionStart, tokens[pos]);
	}
	pos++;
	const mainBlock = parseLineBlock(ifToken);
	let elseBlock = null;
	if (tokens[pos]?.type === "else") {
		pos++;
		elseBlock = parseLineBlock(tokens[pos-1]);
	}
	return new ast.IfNode(condition, mainBlock, elseBlock);
}
// if playerNode is null, no player is given a choice and the section is forced.
function parseOptionalSection(playerNode) {
	pos++;
	const mainBlock = parseLineBlock(tokens[pos-1]);
	let thenBlock = null;
	if (tokens[pos].type === "then") {
		pos++;
		thenBlock = parseLineBlock(tokens[pos-1]);
	}
	let elseBlock = null;
	if (tokens[pos].type === "else") {
		pos++;
		elseBlock = parseLineBlock(tokens[pos-1]);
	}
	return new ast.OptionalSectionNode(playerNode, mainBlock, thenBlock, elseBlock);
}
function parseAtStatement() {
	const atToken = tokens[pos];
	pos++;
	if (tokens[pos]?.type !== "leftParen") {
		throw new ScriptParserError("Expected parenthesized expression after 'at'.", tokens[pos-1]);
	}
	const timeIndicatorStart = tokens[pos];
	pos++;
	const timeIndicator = parseExpression();
	if (tokens[pos]?.type !== "rightParen") {
		throw new ScriptParserError("Expected a ')' at the end of this expression." + (tokens[pos]? ` Found '${tokens[pos].value}' instead.` : ""), timeIndicatorStart, tokens[pos] ?? tokens.at(-1));
	}
	if (timeIndicator.returnType !== "timeIndicator") {
		throw new ScriptParserError(`An at-statement needs a time indicator. This evaluates to a value of type '${timeIndicator.returnType}' instead.`, timeIndicatorStart, tokens[pos]);
	}
	pos++;
	const mainBlock = parseLineBlock(atToken);
	return new ast.AtNode(timeIndicator, mainBlock);
}

function parseTurnDotAccess(turnNode) {
	switch (tokens[pos].type) {
		case "actionAccessor": {
			return parseActionAccessor(turnNode);
		}
		case "end": {
			pos++;
			return new ast.EndOfTurnNode(turnNode);
		}
		case "phaseType": {
			const node = new ast.StartOfPhaseNode(turnNode, tokens[pos].value);
			pos++;
			return node;
		}
		default: {
			throw new ScriptParserError("'" + tokens[pos].value + "' does not start a valid turn property.", tokens[pos]);
		}
	}
}
function parsePlayerDotAccess(playerNode) {
	switch (tokens[pos].type) {
		case "playerProperty": {
			let property = tokens[pos].value;
			let node = new ast.PlayerPropertyNode(playerNode, tokens[pos].value);
			pos++;
			if (tokens[pos] && tokens[pos].type == "dotOperator") {
				pos++;
				if (property === "partner") {
					return parseCardDotAccess(node);
				} // else
				throw new ScriptParserError("Cannot access any properties of '" + property + "'.", tokens[pos-1]);
			}
			return node;
		}
		case "function": {
			return parseFunctionToken(playerNode);
		}
		case "deckPosition": {
			let node = new ast.DeckPositionNode(playerNode, tokens[pos].value);
			pos++;
			return node;
		}
		case "zone": {
			return parseZoneToken(playerNode);
		}
		case "turn": {
			const turn = new ast.TurnNode(playerNode, false);
			pos++;
			if (tokens[pos] && tokens[pos].type === "dotOperator") {
				pos++;
				return parseTurnDotAccess(turn);
			}
			return turn;
		}
		case "nextTurn": {
			const turn = new ast.TurnNode(playerNode, true);
			pos++;
			if (tokens[pos] && tokens[pos].type === "dotOperator") {
				pos++;
				return parseTurnDotAccess(turn);
			}
			return turn;
		}
		case "phaseType": {
			const node = new ast.PhaseNode(playerNode, tokens[pos].value);
			pos++;
			return node;
		}
		case "may": {
			return parseOptionalSection(playerNode);
		}
	}
	throw new ScriptParserError(`'${tokens[pos].value}' does not begin a valid player property.`, tokens[pos]);
}
function parseCardDotAccess(cardsNode) {
	if (tokens[pos].type != "cardProperty") {
		throw new ScriptParserError("'" + tokens[pos].value + "' does not begin a valid card property.", tokens[pos]);
	}
	let property = tokens[pos].value;
	let node = new ast.CardPropertyNode(cardsNode, tokens[pos].value);
	pos++;
	if (tokens[pos] && tokens[pos].type === "dotOperator") {
		pos++;
		switch (property) {
			case "owner":
			case "baseOwner": {
				return parsePlayerDotAccess(node);
			}
			case "equipments":
			case "equippedUnit":
			case "fightingAgainst": {
				return parseCardDotAccess(node);
			}
			default: {
				throw new ScriptParserError("Cannot access any properties of '" + property + "'.", tokens[pos-1]);
			}
		}
	}
	return node;
}
function parseFightDotAccess(fightsNode) {
	switch (tokens[pos].type) {
		case "fightProperty": {
			let property = tokens[pos].value;
			let node = new ast.FightPropertyNode(fightsNode, tokens[pos].value);
			pos++;
			if (tokens[pos] && tokens[pos].type === "dotOperator") {
				pos++;
				switch (property) {
					case "dealDamageTo": {
						return parsePlayerDotAccess(node);
					}
					case "participants": {
						return parseCardDotAccess(node);
					}
					default: {
						throw new ScriptParserError("Cannot access any properties of '" + property + "'.", tokens[pos-1]);
					}
				}
			}
			return node;
		}
		default: {
			throw new ScriptParserError("'" + tokens[pos].value + "' does not begin a valid fight property.", tokens[pos]);
		}
	}
}

function parseActionAccessor(actionsNode) {
	let actionType = tokens[pos].value;
	pos++;
	// accessor properties like 'dueTo' or 'by'
	let properties = {};
	if (tokens[pos].type === "leftParen") {
		pos++;
		while (["accessorProperty", "from"].includes(tokens[pos].type)) {
			let property = tokens[pos].value;
			pos++;
			if (tokens[pos].type !== "colon") {
				throw new ScriptParserError("'" + property + "' must be followed by a colon.", tokens[pos]);
			}
			pos++;
			properties[property] = parseExpression();
			if (tokens[pos].type === "separator") pos++;
		}
		pos++;
	}
	let node = new ast.ActionAccessorNode(actionsNode, actionType, properties);
	if (tokens[pos] && tokens[pos].type === "dotOperator") {
		pos++;
		return parseCardDotAccess(node);
	}
	return node;
}

function parseVariable() {
	if (!variableTypes[effectId]?.[tokens[pos].value]) {
		throw new ScriptParserError("Reference to unassigned variable " + tokens[pos].value + ".", tokens[pos]);
	}
	let node = new ast.VariableNode(tokens[pos].value, variableTypes[effectId][tokens[pos].value]);
	pos++;
	return node;
}
function parsePlayer() {
	const node = new ast.PlayerNode(tokens[pos].value);
	pos++;
	return node;
}

function parseNumber() {
	let negative = false;
	if (tokens[pos].type === "minus") {
		negative = true;
		pos++;
	}
	let value = parseInt(tokens[pos].value);
	if (negative) {
		value *= -1;
	}
	const node = new ast.ValueNode([value], "number");
	pos++;
	return node;
}

function parseBool() {
	const node = new ast.ValueNode([tokens[pos].value === "yes"], "bool");
	pos++;
	return node;
}

function parseList() {
	const listStartPos = pos;
	const elements = [];
	let type = null;
	do {
		pos++;
		const itemStartPos = pos;
		const value = parseValue();
		type ??= value.returnType;
		if (value.returnType !== type) {
			throw new ScriptParserError(`All values in a list must be of the same type. Expected '${type}' but got '${value.returnType}'.`, tokens[itemStartPos], tokens[pos-1]);
		}
		elements.push(value);
	} while (tokens[pos].type === "separator");

	if (tokens[pos].type !== "rightBracket") {
		throw new ScriptParserError("Expected a ']' at the end of this list.", tokens[listStartPos], tokens[pos]);
	}
	pos++;
	return new ast.ArrayNode(elements, type);
}

function parseZone() {
	const zoneStartPos = pos;
	let player = null;
	switch (tokens[pos].type) {
		case "zone": {
			// null player will be interpreted as both players
			break;
		}
		case "player": {
			player = parsePlayer();
			if (tokens[pos].type != "dotOperator" || tokens[pos+1].type != "zone") {
				throw new ScriptParserError("Failed to parse zone.", tokens[zoneStartPos], tokens[pos+1]);
			}
			pos++;
			break;
		}
		case "variable": {
			player = parseVariable();
			if (tokens[pos].type != "dotOperator" || tokens[pos+1].type != "zone") {
				throw new ScriptParserError("Failed to parse zone.", tokens[zoneStartPos], tokens[pos+1]);
			}
			pos++;
			break;
		}
		default: {
			throw new ScriptParserError("Expected a zone here.", tokens[pos]);
		}
	}

	return parseZoneToken(player);
}
function parseZoneToken(player) {
	let node = new ast.ZoneNode(tokens[pos].value, player);
	pos++;
	return node;
}

function parseCardMatcher() {
	pos += 2; // just skip over the 'from' token
	const objectLists = [];
	while (tokens[pos].type != "where" && tokens[pos].type != "rightBracket") {
		const valueStartPos = pos;
		const source = parseExpression();
		if (!["zone", "card", "fight"].includes(source.returnType)) {
			throw new ScriptParserError("Card matcher can only select from zones, card lists or fights.", tokens[valueStartPos], tokens[pos-1]);
		}
		objectLists.push(source);
		if (tokens[pos].type == "separator") {
			pos++;
		}
	}

	let conditions = null;
	if (tokens[pos].type == "where") {
		pos++;
		conditions = parseExpression();
	}

	if (tokens[pos].type != "rightBracket") {
		throw new ScriptParserError("Card matcher must end in ']'.", tokens[pos]);
	}

	pos++;
	return new ast.ObjectMatchNode(objectLists, conditions);
}

function parseModifier(forStaticAbility = false) {
	const modifierStartPos = pos;
	let valueModifications = [];
	let hasActionModification = false;
	let hasNonActionModification = false;
	while (tokens[pos] && tokens[pos].type != "rightBrace") {
		pos++;
		switch (tokens[pos].type) {
			case "cardProperty":
			case "playerProperty":
			case "fightProperty": {
				valueModifications = valueModifications.concat(parseValueModifications());
				hasNonActionModification = true;
				break;
			}
			case "immunityAssignment": {
				valueModifications.push(parseCompletelyUnaffectedModification());
				hasNonActionModification = true;
				break;
			}
			case "cancelAbilities": {
				valueModifications.push(parseAbilityCancelModification());
				hasNonActionModification = true;
				break;
			}
			case "prohibit": {
				valueModifications.push(parseProhibitModification());
				hasNonActionModification = true;
				break;
			}
			case "cancel": {
				const modificationStartToken = tokens[pos];
				if (!forStaticAbility) throw new ScriptParserError("Cancel modifiers are not allowed outside of static abilities. (Did you mean cancelAbilities?)", modificationStartToken);
				valueModifications.push(parseCancelModification());
				if (hasActionModification) throw new ScriptParserError("A modifier can't have more than one replace or cancel modification.", modificationStartToken, tokens[pos-1]);
				hasActionModification = true;
				break;
			}
			case "replace": {
				const modificationStartToken = tokens[pos];
				valueModifications.push(parseReplaceModification());
				if (hasActionModification) throw new ScriptParserError("A modifier can't have more than one replace or cancel modification.", modificationStartToken, tokens[pos-1]);
				hasActionModification = true;
				break;
			}
			default: {
				throw new ScriptParserError("'" + tokens[pos].value + "' does not start a valid modifier.", tokens[pos]);
			}
		}
	}
	if (hasActionModification && hasNonActionModification) {
		throw new ScriptParserError("Modifier cannot contain both action modification effects and non-action modification effects.", tokens[modifierStartPos], tokens[pos]);
	}
	pos++;
	return new ast.ModifierNode(valueModifications);
}

// parses the if <condition> that can follow any of the below modifications or
function parseIfCondition() {
	if (tokens[pos] && tokens[pos].type === "if") {
		pos++;
		return parseExpression();
	}
	return null;
}

function parseReplaceModification() {
	pos++;
	const startToken = tokens[pos];
	const toReplace = parseExpression();
	if (toReplace.returnType !== "bool") {
		throw new ScriptParserError(`The replace check expression must return a value of type 'bool', not '${toReplace.returnType}'.`, startToken, tokens[pos-1]);
	}

	if (tokens[pos].type !== "with") {
		throw new ScriptParserError("Expected a 'with' here.", tokens[pos]);
	}
	pos++;

	const replacement = parseLine();
	pos++;

	return new valueModifiers.ActionReplaceModification(toReplace, replacement, parseIfCondition());
}

function parseCancelModification() {
	pos++;
	const startToken = tokens[pos];
	const toCancel = parseExpression();
	if (toCancel.returnType !== "bool") {
		throw new ScriptParserError(`The cancel check expression must return a value of type 'bool', not '${toCancel.returnType}'.`, startToken, tokens[pos-1]);
	}

	return new valueModifiers.ActionCancelModification(toCancel, parseIfCondition());
}

function parseAbilityCancelModification() {
	pos++;

	return new valueModifiers.AbilityCancelModification("abilities", false, parseIfCondition());
}

function parseProhibitModification() {
	pos++;
	const startToken = tokens[pos];
	const toProhibit = parseExpression();
	if (toProhibit.returnType !== "bool") {
		throw new ScriptParserError(`The prohibit check expression must return a value of type 'bool', not '${toProhibit.returnType}'.`, startToken, tokens[pos-1]);
	}

	return new valueModifiers.ProhibitModification(toProhibit, parseIfCondition());
}

function parseCompletelyUnaffectedModification() {
	pos++;
	const rightHandSide = parseExpression();

	// maybe parse 'if' condition
	const condition = parseIfCondition();

	return new valueModifiers.CompletelyUnaffectedModification(rightHandSide, condition);
}

// TODO: Make number modifiers work on yourLifeDamage and opponentLifeDamage and figure out if they need to be in this list for that.
const numberProperties = ["level", "attack", "defense", "attackRights", "manaGainAmount", "standardDrawAmount"];
function parseValueModifications() {
	const modificationStartPos = pos;
	const valueIdentifiers = [];
	let propertyType = null;
	do {
		if (!["cardProperty", "playerProperty", "fightProperty"].includes(tokens[pos].type)) {
			throw new ScriptParserError("'" + tokens[pos].value + "' is not a property that can be modified.", tokens[pos]);
		}
		if (propertyType && tokens[pos].type != propertyType) {
			throw new ScriptParserError("This property does not belong to the same type of object (player, card...) as the previous ones.", tokens[pos]);
		}
		propertyType = tokens[pos].type;
		valueIdentifiers.push(tokens[pos].value);
		pos += 2;
	} while (tokens[pos-1].type === "separator");
	pos--;

	const toBaseValues = [];
	for (let i = 0; i < valueIdentifiers.length; i++) {
		if (valueIdentifiers[i].startsWith("base")) {
			valueIdentifiers[i] = valueIdentifiers[i][4].toLowerCase() + valueIdentifiers[i].substring(5);
			toBaseValues.push(true);
		} else {
			toBaseValues.push(false);
		}
		if (valueIdentifiers[i] === "name") {
			valueIdentifiers[i] = "names";
		}
	}

	if (!["immunityAssignment", "equals", "plusAssignment", "minusAssignment", "divideAssignment", "swapAssignment"].includes(tokens[pos].type)) {
		throw new ScriptParserError("'" + tokens[pos].value + "' is not a valid assignment operator in a modifier.", tokens[pos]);
	}
	const assignmentPos = pos; // for later error messages
	const assignmentType = tokens[pos].type;
	pos++;

	let rightHandSide;
	if (assignmentType != "swapAssignment") {
		rightHandSide = parseExpression();
	} else {
		if (tokens[pos].type != propertyType) {
			throw new ScriptParserError("Swap modifier (><) cannot swap a " + propertyType + " with a " + tokens[pos].type + ".", tokens[modificationStartPos], tokens[pos]);
		}
		rightHandSide = tokens[pos].value;
		pos++;
	}

	// maybe parse 'if' condition
	const condition = parseIfCondition();

	const valueModifications = [];
	for (const [i, valueIdentifier] of valueIdentifiers.entries()) {
		switch (assignmentType) {
			case "immunityAssignment": {
				valueModifications.push(new valueModifiers.ValueUnaffectedModification(valueIdentifier, rightHandSide, toBaseValues[i], condition));
				break;
			}
			case "equals": {
				if (["yourLifeDamage", "opponentLifeDamage"].includes(valueIdentifier)) {
					valueModifications.push(new valueModifiers.DamageOverrideSetModification(valueIdentifier, rightHandSide, condition));
				} else {
					valueModifications.push(new valueModifiers.ValueSetModification(valueIdentifier, rightHandSide, toBaseValues[i], condition));
				}
				break;
			}
			case "plusAssignment": {
				if (numberProperties.includes(valueIdentifier)) {
					valueModifications.push(new valueModifiers.NumericChangeModification(valueIdentifier, rightHandSide, toBaseValues[i], condition));
				} else {
					valueModifications.push(new valueModifiers.ValueAppendModification(valueIdentifier, rightHandSide, toBaseValues[i], condition));
				}
				break;
			}
			case "minusAssignment": {
				if (!numberProperties.includes(valueIdentifier)) {
					throw new ScriptParserError("Modifier cannot subtract from non-number card property '" + valueIdentifier + "'.", tokens[modificationStartPos], tokens[assignmentPos]);
				}
				valueModifications.push(new valueModifiers.NumericChangeModification(valueIdentifier, new ast.UnaryMinusNode(rightHandSide), toBaseValues[i], condition));
				break;
			}
			case "divideAssignment": {
				if (!numberProperties.includes(valueIdentifier)) {
					throw new ScriptParserError("Modifier cannot divide non-number card property '" + valueIdentifier + "'.", tokens[modificationStartPos], tokens[assignmentPos]);
				}
				valueModifications.push(new valueModifiers.NumericDivideModification(valueIdentifier, rightHandSide, toBaseValues[i], condition));
				break;
			}
			case "swapAssignment": {
				if (rightHandSide.startsWith("base") != toBaseValues[i]) {
					throw new ScriptParserError("Swap modifier (><) cannot swap base value with non-base value.", tokens[assignmentPos]);
				}
				if (toBaseValues[i]) {
					rightHandSide = rightHandSide[4].toLowerCase() + rightHandSide.substring(5);
				}
				valueModifications.push(new valueModifiers.ValueSwapModification(valueIdentifier, rightHandSide, toBaseValues[i], condition));
				break;
			}
		}
	}
	return valueModifications;
}
