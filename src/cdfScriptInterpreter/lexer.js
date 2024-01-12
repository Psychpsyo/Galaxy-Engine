const keywordTokenTypes = {
	from: "from",
	where: "where",
	if: "if",
	unaffectedBy: "immunityAssignment",
	cancel: "cancel",
	cancelAbilities: "cancelAbilities",
	replace: "replace",
	with: "with",

	thisCard: "thisCard",
	attackTarget: "attackTarget",
	attackers: "attackers",

	currentPhase: "currentPhase",
	currentTurn: "currentTurn",
	currentBlock: "currentBlock",
	turn: "turn",

	any: "anyAmount",
	allTypes: "allTypes",

	yes: "bool",
	no: "bool",

	you: "player",
	opponent: "player",
	both: "player",
	own: "player",

	life: "playerProperty",
	mana: "playerProperty",
	partner: "playerProperty",
	manaGainAmount: "playerProperty",
	standardDrawAmount: "playerProperty",
	needsToPayForPartner: "playerProperty",
	canEnterBattlePhase: "playerProperty",

	name: "cardProperty",
	baseName: "cardProperty",
	level: "cardProperty",
	baseLevel: "cardProperty",
	types: "cardProperty",
	baseTypes: "cardProperty",
	abilities: "cardProperty",
	baseAbilities: "cardProperty",
	attack: "cardProperty",
	baseAttack: "cardProperty",
	defense: "cardProperty",
	baseDefense: "cardProperty",
	cardType: "cardProperty",
	baseCardType: "cardProperty",
	owner: "cardProperty",
	baseOwner: "cardProperty",
	equippedUnit: "cardProperty",
	equipments: "cardProperty",
	attackRights: "cardProperty",
	attacksMade: "cardProperty",
	canAttack: "cardProperty",
	canCounterattack: "cardProperty",
	fightingAgainst: "cardProperty",
	self: "cardProperty",
	zone: "cardProperty",
	isToken: "cardProperty",

	field: "zone",
	deck: "zone",
	discard: "zone",
	exile: "zone",
	hand: "zone",
	unitZone: "zone",
	spellItemZone: "zone",
	partnerZone: "zone",

	deckTop: "deckPosition",
	deckBottom: "deckPosition",

	manaSupplyPhase: "phaseType",
	drawPhase: "phaseType",
	mainPhase: "phaseType",
	mainPhase1: "phaseType",
	battlePhase: "phaseType",
	mainPhase2: "phaseType",
	endPhase: "phaseType",

	abilityActivationBlock: "blockType",
	attackDeclarationBlock: "blockType",
	castBlock: "blockType",
	deployBlock: "blockType",
	fightBlock: "blockType",
	retireBlock: "blockType",
	standardDrawBlock: "blockType",
	standardSummonBlock: "blockType",

	unit: "cardType",
	spell: "cardType",
	standardSpell: "cardType",
	continuousSpell: "cardType",
	enchantSpell: "cardType",
	item: "cardType",
	standardItem: "cardType",
	continuousItem: "cardType",
	equipableItem: "cardType",

	APPLY: "function",
	CANCELATTACK: "function",
	COUNT: "function",
	DAMAGE: "function",
	DECKTOP: "function",
	DESTROY: "function",
	DIFFERENT: "function",
	DISCARD: "function",
	DRAW: "function",
	EXILE: "function",
	GAINLIFE: "function",
	GAINMANA: "function",
	GETCOUNTERS: "function",
	GIVEATTACK: "function",
	LOSELIFE: "function",
	LOSEMANA: "function",
	MOVE: "function",
	ORDER: "function",
	PUTCOUNTERS: "function",
	REMOVECOUNTERS: "function",
	REVEAL: "function",
	SELECT: "function",
	SELECTDECKSIDE: "function",
	SELECTPLAYER: "function",
	SELECTTYPE: "function",
	SETATTACKTARGET: "function",
	SHUFFLE: "function",
	SUM: "function",
	SUMMON: "function",
	SUMMONTOKENS: "function",
	SWAP: "function",
	VIEW: "function",

	attacked: "actionAccessor",
	cast: "actionAccessor",
	chosenTarget: "actionAccessor",
	declared: "actionAccessor",
	deployed: "actionAccessor",
	destroyed: "actionAccessor",
	discarded: "actionAccessor",
	exiled: "actionAccessor",
	moved: "actionAccessor",
	retired: "actionAccessor",
	summoned: "actionAccessor",
	targeted: "actionAccessor",
	viewed: "actionAccessor",

	dueTo: "accessorProperty",
	by: "accessorProperty",

	effect: "dueToReason",
	fight: "dueToReason",
	invalidEquipment: "dueToReason",
	standardSummon: "dueToReason",
	deployment: "dueToReason",
	casting: "dueToReason",
	retire: "dueToReason",
	wasCast: "dueToReason",
	wasDeployed: "dueToReason",

	forever: "untilIndicator",
	endOfTurn: "untilIndicator",
	endOfNextTurn: "untilIndicator",
	endOfYourNextTurn: "untilIndicator",
	endOfOpponentNextTurn: "untilIndicator"
}

export class ScriptLexerError extends Error {
	constructor(message, code, effectId, line, startColumn, endColumn = startColumn) {
		// generate error message
		message += " (on " + effectId + ")\n";
		const lines = code.split("\n");
		message += "\n" + line.toString() + ": " + lines[line];
		message += "\n" + " ".repeat(line.toString().length + 2 + startColumn) + "^".repeat(endColumn - startColumn);

		super(message);
		this.name = "ScriptLexerError";
		this.cardId = effectId.substring(0, effectId.indexOf(":"));
		this.effectId = effectId;
	}
}

class ScriptToken {
	constructor(type, value, line, column) {
		this.type = type;
		this.value = value;
		this.line = line;
		this.column = column;
	}
}

export function tokenize(code, effectId, game) {
	let line = 0;
	let lineStart = 0;
	let pos = 0;
	const tokens = [];
	while (pos < code.length) {
		switch (code[pos]) {
			case " ":
			case "\t": {
				pos++;
				break;
			}
			case "\n": {
				pos++;
				line++;
				lineStart = pos;
				break;
			}
			case "(": {
				tokens.push(new ScriptToken("leftParen", "(", line, pos - lineStart));
				pos++;
				break;
			}
			case ")": {
				tokens.push(new ScriptToken("rightParen", ")", line, pos - lineStart));
				pos++;
				break;
			}
			case "[": {
				tokens.push(new ScriptToken("leftBracket", "[", line, pos - lineStart));
				pos++;
				break;
			}
			case "]": {
				tokens.push(new ScriptToken("rightBracket", "]", line, pos - lineStart));
				pos++;
				break;
			}
			case "{": {
				tokens.push(new ScriptToken("leftBrace", "{", line, pos - lineStart));
				pos++;
				break;
			}
			case "}": {
				tokens.push(new ScriptToken("rightBrace", "{", line, pos - lineStart));
				pos++;
				break;
			}
			case ",": {
				tokens.push(new ScriptToken("separator", ",", line, pos - lineStart));
				pos++;
				break;
			}
			case ";": {
				tokens.push(new ScriptToken("newLine", ";", line, pos - lineStart));
				pos++;
				break;
			}
			case ".": {
				tokens.push(new ScriptToken("dotOperator", ".", line, pos - lineStart));
				pos++;
				break;
			}
			case ":": {
				tokens.push(new ScriptToken("colon", ":", line, pos - lineStart));
				pos++;
				break;
			}
			case "?": {
				tokens.push(new ScriptToken("asmapOperator", "?", line, pos - lineStart));
				pos++;
				break;
			}
			case "&": {
				tokens.push(new ScriptToken("andOperator", "&", line, pos - lineStart));
				pos++;
				break;
			}
			case "|": {
				tokens.push(new ScriptToken("orOperator", "|", line, pos - lineStart));
				pos++;
				break;
			}
			case "-": {
				if (code[pos+1] == "=") {
					tokens.push(new ScriptToken("minusAssignment", "-=", line, pos - lineStart));
					pos++;
				} else {
					tokens.push(new ScriptToken("minus", "-", line, pos - lineStart));
				}
				pos++;
				break;
			}
			case "+": {
				if (code[pos+1] == "=") {
					tokens.push(new ScriptToken("plusAssignment", "+=", line, pos - lineStart));
					pos++;
				} else {
					tokens.push(new ScriptToken("plus", "+", line, pos - lineStart));
				}
				pos++;
				break;
			}
			case "*": {
				tokens.push(new ScriptToken("multiply", "*", line, pos - lineStart));
				pos++;
				break;
			}
			case "/": {
				if (code[pos+1] == "=") {
					tokens.push(new ScriptToken("divideAssignment", "/=", line, pos - lineStart));
					pos++;
				} else {
					tokens.push(new ScriptToken("divide", "/", line, pos - lineStart));
				}
				pos++;
				break;
			}
			case "\\": {
				tokens.push(new ScriptToken("floorDivide", "\\", line, pos - lineStart));
				pos++;
				break;
			}
			case "=": {
				tokens.push(new ScriptToken("equals", "=", line, pos - lineStart));
				pos++;
				break;
			}
			case "!": {
				if (code[pos+1] == "=") {
					tokens.push(new ScriptToken("notEquals", "!=", line, pos - lineStart));
					pos++;
				} else {
					tokens.push(new ScriptToken("bang", "!", line, pos - lineStart));
				}
				pos++;
				break;
			}
			case ">": {
				if (code[pos+1] == "<") {
					tokens.push(new ScriptToken("swapAssignment", "><", line, pos - lineStart));
					pos++;
				} else {
					tokens.push(new ScriptToken("greaterThan", ">", line, pos - lineStart));
				}
				pos++;
				break;
			}
			case "<": {
				tokens.push(new ScriptToken("lessThan", "<", line, pos - lineStart));
				pos++;
				break;
			}
			case "$": {
				let variableLength = 1;
				while(code[pos + variableLength] && code[pos + variableLength].match(/[a-z]/i)) {
					variableLength++;
				}
				const variableName = code.substring(pos, pos + variableLength);
				tokens.push(new ScriptToken("variable", variableName, line, pos - lineStart));
				pos += variableLength;
				break;
			}
			default: {
				if (code[pos].match(/[a-z]/i)) {
					let wordLength = 1;
					while(code[pos + wordLength] && code[pos + wordLength].match(/[a-z0-9]/i)) {
						wordLength++;
					}
					let word = code.substring(pos, pos + wordLength);
					if (keywordTokenTypes[word]) {
						tokens.push(new ScriptToken(keywordTokenTypes[word], word, line, pos - lineStart));
					} else if (word.startsWith("CU")) {
						if (code[pos + wordLength] === ":") {
							// this is a card ability ID
							const extraLength = code[pos + wordLength + 2] === ":"? 4 : 2; // might be a sub-ability
							tokens.push(new ScriptToken("abilityId", code.substring(pos, pos + wordLength + extraLength), line, pos - lineStart));
							pos += extraLength;
						} else {
							// this is a card ID
							tokens.push(new ScriptToken("cardId", code.substring(pos, pos + wordLength), line, pos - lineStart));
						}
					} else if (game.config.allTypes.includes(word)) {
						tokens.push(new ScriptToken("type", word, line, pos - lineStart));
					} else if (game.config.allCounters.includes(word)) {
						tokens.push(new ScriptToken("counter", word, line, pos - lineStart));
					} else {
						throw new ScriptLexerError("Found unknown word '" + word + "' while tokenizing.", code, effectId, line, pos - lineStart, pos - lineStart + wordLength);
					}
					pos += wordLength;
					break;
				}
				if (code[pos].match(/[0-9]/)) {
					let numLength = 1;
					while(code[pos + numLength] && code[pos + numLength].match(/[0-9]/i)) {
						numLength++;
					}
					tokens.push(new ScriptToken("number", code.substring(pos, pos + numLength), line, pos - lineStart));
					pos += numLength;
					break;
				}
				throw new ScriptLexerError("Found unknown character '" + code.codePointAt(pos) + "' while tokenizing.", code, effectId, line, pos - lineStart);
			}
		}
	}
	return tokens;
}