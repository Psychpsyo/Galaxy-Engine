import * as ast from "./astNodes.js";
import * as valueModifiers from "../valueModifiers.js";

let code; // the actual text representation of the code being parsed
let tokens; // the token stream emitted by the lexer
let pos; // the current position in the token stream
let effectId; // The effect that is currently being parsed.
let cardId; // the card the effect is on

// contains a list of objects holding variable definition types, indexed by their card IDs, like so:
// {
// 	"CUU00161": {
// 		"$units": "card"
// 	}
// }
let foundVariables = {};

export class ScriptParserError extends Error {
	constructor(message, startToken, endToken = startToken) {
		// generate error message
		message += " (on " + effectId + ")\n";
		const lines = code.split("\n");
		const maxLineNumberLenght = endToken.line.toString().length;
		for (let i = startToken.line; i <= endToken.line; i++) {
			message += "\n" + i.toString().padStart(maxLineNumberLenght) + ": " + lines[i];
			const startColumn = i === startToken.line? startToken.column : 0;
			const endColumn = i === endToken.line? endToken.column + endToken.value.length : lines[i].length - 1;
			message += "\n" + " ".repeat(maxLineNumberLenght + 2 + startColumn) + "^".repeat(endColumn - startColumn);
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
	effectId = newEffectId;
	cardId = effectId.substring(0, effectId.indexOf(":"));
	tokens = tokenList;
	pos = 0;

	switch (type) {
		case "applyTarget":
		case "cardCondition":
		case "condition":
		case "during":
		case "equipableTo":
		case "gameLimit":
		case "zoneDurationLimit":
		case "globalTurnLimit":
		case "turnLimit": {
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
			return parseSteps();
		}
	}
}

function parseSteps() {
	let steps = [];
	while(pos < tokens.length) {
		switch (tokens[pos].type) {
			case "newLine": {
				pos++;
				break;
			}
			case "rightBrace": {
				return new ast.ScriptRootNode(steps);
			}
			default: {
				steps.push(parseLine());
				break;
			}
		}
	}
	return new ast.ScriptRootNode(steps);
}

function parseLine() {
	let variableName = null;
	if (tokens[pos].type === "variable" && tokens[pos+1].type === "equals") {
		variableName = tokens[pos].value;
		pos += 2;
	}
	let expr = parseExpression();
	// check variable type
	if (variableName) {
		if (!foundVariables[cardId]) {
			foundVariables[cardId] = {};
		}
		if (!foundVariables[cardId][variableName]) {
			foundVariables[cardId][variableName] = expr.returnType;
		} else if (foundVariables[cardId][variableName] !== expr.returnType) {
			new ScriptParserError("Invalid assignment of type " + expr.returnType + " to variable " + variableName + " of type " + foundVariables[cardId][variableName] + ".", tokens[pos - 2]);
		}
	}
	return new ast.LineNode(expr, variableName);
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

function parseExpression() {
	const expressionStartPos = pos;
	let expression = [];
	let needsReturnType = [];
	while (tokens[pos] && !["rightParen", "rightBracket", "rightBrace", "newLine", "separator", "if", "with"].includes(tokens[pos].type)) {
		expression.push(parseValue());
		if (tokens[pos]) {
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
				case "lessThan": {
					expression.push(new ast.LessThanNode(null, null));
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
					continue;
				}
			}
			needsReturnType.push(expression[expression.length - 1]);
			pos++;
		}
	}

	if (expression.length == 0) {
		return null;
	}

	for (let type of [ast.DotMathNode, ast.DashMathNode, ast.ComparisonNode, ast.LogicNode]) {
		for (let i = 0; i < expression.length; i++) {
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
	while (needsReturnType.length > 0) {
		for (let i = needsReturnType.length - 1; i >= 0; i--) {
			if (needsReturnType[i].returnType !== null) {
				needsReturnType.splice(i, 1);
				continue;
			}
			if (needsReturnType[i].leftSide.returnType) {
				needsReturnType[i].returnType = needsReturnType[i].leftSide.returnType;
				needsReturnType.splice(i, 1);
			}
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
			return new ast.AnyAmountNode();
		}
		case "allTypes": {
			pos++;
			return new ast.AllTypesNode();
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
			let player = parsePlayer();
			if (tokens[pos] && tokens[pos].type == "dotOperator") {
				pos++;
				return parsePlayerDotAccess(player);
			}
			return player;
		}
		case "leftBracket": {
			if (tokens[pos+1].type == "from") {
				let cardMatcher = parseCardMatcher();
				if (tokens[pos] && tokens[pos].type == "dotOperator") {
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
			const node = new ast.ValueArrayNode([tokens[pos].value.substring(2)], tokens[pos].type);
			pos++;
			return node;
		}
		case "cardType":
		case "counter":
		case "dueToReason":
		case "type": {
			const node = new ast.ValueArrayNode([tokens[pos].value], tokens[pos].type);
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
			let variable = parseVariable();
			if (tokens[pos] && tokens[pos].type == "dotOperator") {
				pos++;
				switch (tokens[pos].type) {
					case "phaseType":
					case "turn":
					case "function":
					case "deckPosition":
					case "playerProperty":
					case "zone": {
						return parsePlayerDotAccess(variable);
					}
					case "cardProperty": {
						return parseCardDotAccess(variable);
					}
					case "actionAccessor": {
						return parseActionAccessor(variable);
					}
					default: {
						throw new ScriptParserError("'" + tokens[pos].value + "' does not start a valid variable property.", tokens[pos]);
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
			return parseCardProperty(new ast.ImplicitValuesNode("card"));
		}
		case "playerProperty": {
			return parsePlayerDotAccess(new ast.ImplicitValuesNode("player"));
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
			let node = new ast.CurrentTurnNode();
			pos++;
			if (tokens[pos] && tokens[pos].type == "dotOperator") {
				pos++;
				if (tokens[pos].type == "actionAccessor") {
					return parseActionAccessor(node);
				} else {
					throw new ScriptParserError("'" + tokens[pos].value + "' does not start a valid turn property.", tokens[pos]);
				}
			}
			return node;
		}
		case "leftBrace": {
			return parseModifier();
		}
		case "untilIndicator": {
			let node = new ast.UntilIndicatorNode(tokens[pos].value);
			pos++;
			return node;
		}
		default: {
			throw new ScriptParserError("'" + tokens[pos].value + "' does not start a valid value.", tokens[pos]);
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
			pos++;
			return new ast.TurnNode(playerNode);
		}
		case "phaseType": {
			let node = new ast.PhaseNode(playerNode, tokens[pos].value);
			pos++;
			return node;
		}
	}
	throw new ScriptParserError("'" + tokens[pos].value + "' does not begin a valid player value.", tokens[pos]);
}
function parseCardDotAccess(card) {
	if (tokens[pos].type != "cardProperty") {
		throw new ScriptParserError("'" + tokens[pos].value + "' does not begin a valid card property.", tokens[pos]);
	}
	return parseCardProperty(card);
}

function parseCardProperty(cardsNode) {
	let property = tokens[pos].value;
	let node = new ast.CardPropertyNode(cardsNode, tokens[pos].value);
	pos++;
	if (tokens[pos] && tokens[pos].type == "dotOperator") {
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
	if (tokens[pos].type == "dotOperator") {
		pos++;
		return parseCardDotAccess(node);
	}
	return node;
}

function parseVariable() {
	if (!foundVariables[cardId]?.[tokens[pos].value]) {
		throw new ScriptParserError("Reference to unassigned variable " + tokens[pos].value + ".", tokens[pos]);
	}
	let node = new ast.VariableNode(tokens[pos].value, foundVariables[cardId][tokens[pos].value]);
	pos++;
	return node;
}
function parsePlayer() {
	let node = new ast.PlayerNode(tokens[pos].value);
	pos++;
	return node;
}

function parseNumber() {
	let negative = false;
	if (tokens[pos].type == "minus") {
		negative = true;
		pos++;
	}
	let value = parseInt(tokens[pos].value);
	if (negative) {
		value *= -1;
	}
	const node = new ast.ValueArrayNode([value], "number");
	pos++;
	return node;
}

function parseBool() {
	const node = new ast.BoolNode(tokens[pos].value);
	pos++;
	return node;
}

function parseList() {
	const listStartPos = pos;
	const elements = [];
	pos++;
	const type = tokens[pos].type;
	while (tokens[pos].type === type) {
		let value = tokens[pos].value;
		switch (type) {
			case "number": {
				value = parseInt(value);
				break;
			}
			case "cardId":
			case "abilityId": {
				value = value.substring(2);
				break;
			}
		}
		elements.push(value);
		pos++;
		if (tokens[pos].type === "separator") {
			pos++;
		}
	}
	if (tokens[pos].type !== "rightBracket") {
		throw new ScriptParserError("Expected a ']' at the end of this list.", tokens[listStartPos], tokens[pos]);
	}
	pos++;
	return new ast.ValueArrayNode(elements, type);
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
	pos++;
	pos++; // just skip over the 'from' token
	let cardLists = [];
	while (tokens[pos].type != "where" && tokens[pos].type != "rightBracket") {
		const valueStartPos = pos;
		const source = parseValue();
		if (!["zone", "card"].includes(source.returnType)) {
			throw new ScriptParserError("Card matcher can only select from zones or card lists.", tokens[valueStartPos], tokens[pos-1]);
		}
		cardLists.push(source);
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
	return new ast.CardMatchNode(cardLists, conditions);
}

function parseModifier(forStaticAbility = false) {
	const modifierStartPos = pos;
	let valueModifications = [];
	let hasActionModification = false;
	let hasNonReplaceModification = false;
	while (tokens[pos] && tokens[pos].type != "rightBrace") {
		switch (tokens[pos+1].type) {
			case "cardProperty":
			case "playerProperty": {
				valueModifications = valueModifications.concat(parseValueModifications());
				hasNonReplaceModification = true;
				break;
			}
			case "cancelAbilities": {
				valueModifications.push(parseAbilityCancelModification());
				hasNonReplaceModification = true;
				break;
			}
			case "cancel": {
				const modificationStartToken = tokens[pos+1];
				if (!forStaticAbility) throw new ScriptParserError("Cancel modifiers are not allowed outside of static abilities. (Did you mean cancelAbilities?)", modificationStartToken);
				valueModifications.push(parseCancelModification());
				if (hasActionModification) throw new ScriptParserError("A modifier can't have more than one replace or cancel modification.", modificationStartToken, tokens[pos-1]);
				hasActionModification = true;
				break;
			}
			case "replace": {
				const modificationStartToken = tokens[pos+1];
				if (!forStaticAbility) throw new ScriptParserError("Replace modifiers are not allowed outside of static abilities.", modificationStartToken);
				valueModifications.push(parseReplaceModification());
				if (hasActionModification) throw new ScriptParserError("A modifier can't have more than one replace or cancel modification.", modificationStartToken, tokens[pos-1]);
				hasActionModification = true;
				break;
			}
			default: {
				throw new ScriptParserError("'" + tokens[pos+1].value + "' does not start a valid modifier.", tokens[pos+1]);
			}
		}
	}
	if (hasActionModification && hasNonReplaceModification) {
		throw new ScriptParserError("Modifier cannot contain both action modification effects and non-action modification effects.", tokens[modifierStartPos], tokens[pos]);
	}
	pos++;
	return new ast.ModifierNode(valueModifications);
}

// parses the if <condition> that can follow any of the below modifications
function parseIfCondition() {
	if (tokens[pos] && tokens[pos].type === "if") {
		pos++;
		return parseExpression();
	}
	return null;
}

function parseReplaceModification() {
	pos += 2;
	const toReplace = parseExpression();

	if (tokens[pos].type !== "with") {
		throw new ScriptParserError("Expected a 'with' here.", tokens[pos]);
	}
	pos++;

	const replacement = parseLine();
	pos++;

	return new valueModifiers.ActionReplaceModification(toReplace, replacement, parseIfCondition());
}

function parseCancelModification() {
	pos += 2;
	const toCancel = parseExpression();

	return new valueModifiers.ActionCancelModification(toCancel, parseIfCondition());
}

function parseAbilityCancelModification() {
	pos += 2;

	return new valueModifiers.AbilityCancelModification("abilities", false, parseIfCondition());
}

function parseValueModifications() {
	const modificationStartPos = pos;
	let valueIdentifiers = [];
	let propertyType = null;
	do {
		pos++;
		if (!["cardProperty", "playerProperty"].includes(tokens[pos].type)) {
			throw new ScriptParserError("'" + tokens[pos].value + "' is not a property that can be modified.", tokens[pos]);
		}
		if (propertyType && tokens[pos].type != propertyType) {
			throw new ScriptParserError("This property does not belong to the same type of object (player, card...) as the previous ones.", tokens[pos]);
		}
		propertyType = tokens[pos].type;
		valueIdentifiers.push(tokens[pos].value);
		pos++;
	} while (tokens[pos].type == "separator");

	const toBaseValues = [];
	for (let i = 0; i < valueIdentifiers.length; i++) {
		if (valueIdentifiers[i].startsWith("base")) {
			valueIdentifiers[i] = valueIdentifiers[i][4].toLowerCase() + valueIdentifiers[i].substring(5);
			toBaseValues.push(true);
		} else {
			toBaseValues.push(false);
		}
		if (valueIdentifiers[i] == "name") {
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
	let condition = parseIfCondition();

	let valueModifications = [];
	for (const [i, valueIdentifier] of valueIdentifiers.entries()) {
		switch (assignmentType) {
			case "immunityAssignment": {
				valueModifications.push(new valueModifiers.ValueUnaffectedModification(valueIdentifier, rightHandSide, toBaseValues[i], condition));
				break;
			}
			case "equals": {
				valueModifications.push(new valueModifiers.ValueSetModification(valueIdentifier, rightHandSide, toBaseValues[i], condition));
				break;
			}
			case "plusAssignment": {
				if (["level", "attack", "defense", "manaGainAmount", "standardDrawAmount"].includes(valueIdentifier)) {
					valueModifications.push(new valueModifiers.NumericChangeModification(valueIdentifier, rightHandSide, toBaseValues[i], condition));
				} else {
					valueModifications.push(new valueModifiers.ValueAppendModification(valueIdentifier, rightHandSide, toBaseValues[i], condition));
				}
				break;
			}
			case "minusAssignment": {
				if (!["level", "attack", "defense", "manaGainAmount", "standardDrawAmount"].includes(valueIdentifier)) {
					throw new ScriptParserError("Modifier cannot subtract from non-number card property '" + valueIdentifier + "'.", tokens[modificationStartPos], tokens[assignmentPos]);
				}
				valueModifications.push(new valueModifiers.NumericChangeModification(valueIdentifier, new ast.UnaryMinusNode(rightHandSide), toBaseValues[i], condition));
				break;
			}
			case "divideAssignment": {
				if (!["level", "attack", "defense", "manaGainAmount", "standardDrawAmount"].includes(valueIdentifier)) {
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