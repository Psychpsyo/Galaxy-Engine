// This file goes through every card CDF and checks
// 1. if it compiles and
// 2. if its basic info matches that at the crossuniverse.net API.

import {promises as fs} from "fs";
import {Card} from "../src/card.mjs";
import {Game} from "../src/game.mjs";
import {ScriptParserError} from "../src/cdfScriptInterpreter/parser.mjs";
import {ScriptLexerError} from "../src/cdfScriptInterpreter/lexer.mjs";
import * as abilities from "../src/abilities.mjs";

const abilityTypes = new Map([
	[abilities.CastAbility, "cast"],
	[abilities.DeployAbility, "deploy"],
	[abilities.FastAbility, "fast"],
	[abilities.OptionalAbility, "optional"],
	[abilities.StaticAbility, "static"],
	[abilities.TriggerAbility, "trigger"]
]);

const game = new Game();

// load card data from the API to match against cdf files
const apiData = await (await fetch("https://crossuniverse.net/cardInfo", {method: "POST", body: "{}"})).json();
const cardData = {};
for (const card of apiData) {
	cardData[card.cardID] = card;
}

// gets the nth ability from a card's API data.
// This is necessary since 'rule' abilities in the API data are not actually abilities.
function getApiDataAbility(card, index) {
	let currentEffect = -1;
	for (const effect of card.effects) {
		if (effect.type !== "rule") currentEffect++;
		if (currentEffect === index) {
			return effect;
		}
	}
}

let allSuccessful = true;
for (const file of await fs.readdir("cards")) {
	const cdf = await fs.readFile("./cards/" + file, "utf8");
	try {
		const card = new Card(game.players[0], cdf);
		const apiCard = cardData[card.cardId];
		if (apiCard.cardID !== card.cardId) {
			allSuccessful = false;
			console.error(`\x1b[31m${file}: Card ID is incorrect! (should be ${apiCard.cardID} instead of ${card.cardId})\x1b[0m\n`);
		}
		if (!card.values.base.names[0] === apiCard.cardId) {
			allSuccessful = false;
			console.error(`\x1b[31m${file}: Card name is incorrect! (should be ${apiCard.cardID} instead of ${card.values.base.names[0]})\x1b[0m\n`);
		}
		if (apiCard.level !== card.values.base.level) {
			allSuccessful = false;
			console.error(`\x1b[31m${file}: Level is incorrect! (should be ${apiCard.level} instead of ${card.values.base.level})\x1b[0m\n`);
		}
		if (!card.values.base.cardTypes.includes(apiCard.cardType)) {
			allSuccessful = false;
			console.error(`\x1b[31m${file}: Card type is incorrect! (should be ${apiCard.cardType} instead of ${card.values.base.cardTypes[0]})\x1b[0m\n`);
		}
		let typesCorrect = true;
		if (card.values.base.types.length !== apiCard.types.length) {
			typesCorrect = false;
		} else {
			for (let i = 0; i < card.values.base.types.length; i++) {
				if (card.values.base.types[i] !== apiCard.types[i]) typesCorrect = false;
			}
		}
		if (!typesCorrect) {
			allSuccessful = false;
			console.error(`\x1b[31m${file}: Types are incorrect! (should be ${apiCard.types.join(", ")} instead of ${card.values.base.types.join(", ")})\x1b[0m\n`);
		}
		if (card.deckLimit !== (apiCard.deckLimit === 50? Infinity : apiCard.deckLimit)) {
			allSuccessful = false;
			console.error(`\x1b[31m${file}: Deck limit is incorrect! (should be ${apiCard.deckLimit === 50? "any" : apiCard.deckLimit} instead of ${card.deckLimit === Infinity? "any" : card.deckLimit})\x1b[0m\n`);
		}
		let filteredEffects = apiCard.effects.filter(effect => effect.type !== "rule");
		if (card.values.base.abilities.length !== filteredEffects.length) {
			allSuccessful = false;
			console.error(`\x1b[31m${file}: Abilities are incorrect! (should have ${filteredEffects.length} instead of ${card.values.base.abilities.length})\x1b[0m\n`);
		} else for (let i = 0; i < card.values.base.abilities; i++) {
			const ability = card.values.base.abilities[i];
			const apiAbility = getApiDataAbility(apiCard, index);
			if (abilityTypes.get(ability.constructor) !== apiAbility.type) {
				allSuccessful = false;
				console.error(`\x1b[31m${file}: Ability #${i+1} is incorrect! (should be ${apiAbility.type} instead of ${abilityTypes.get(ability.constructor)})\x1b[0m\n`);
			} else if (ability instanceof abilities.TriggerAbility) {
				if (ability.mandatory !== apiAbility.mandatory) {
					allSuccessful = false;
					console.error(`\x1b[31m${file}: Ability #${i+1} is incorrect! (mandatory should be ${apiAbility.mandatory? "yes" : "no"} instead of ${ability.mandatory? "yes" : "no"})\x1b[0m\n`);
				}
			}
		}
		if (apiCard.cardType === "unit" && card.values.base.cardTypes.includes("unit")) {
			if (apiCard.attack !== card.values.base.attack) {
				allSuccessful = false;
				console.error(`\x1b[31m${file}: Attack is incorrect! (should be ${apiCard.attack} instead of ${card.values.base.attack})\x1b[0m\n`);
			}
			if (apiCard.defense !== card.values.base.defense) {
				allSuccessful = false;
				console.error(`\x1b[31m${file}: Defense is incorrect! (should be ${apiCard.defense} instead of ${card.values.base.defense})\x1b[0m\n`);
			}
		}
	} catch (e) {
		allSuccessful = false;
		if (e instanceof ScriptParserError || e instanceof ScriptLexerError) {
			console.error(`Error in ${file}:`);
			console.error(`\x1b[31m${e.message}\x1b[0m\n`);
		} else {
			console.error(`Unexpected parser error in ${file}:`);
			console.error(`\x1b[35m${e.message}\x1b[0m\nThis should be fixed in the parser first because these should never happen and the card script might not be broken.\n`);
		}
	}
}