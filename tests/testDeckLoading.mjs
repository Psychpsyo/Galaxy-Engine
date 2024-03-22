// This file tests deck loading functionality

import {promises as fs} from "fs";
import {Game} from "../src/game.mjs";
import * as err from "../src/deckErrors.mjs";

function testDeck(name, deck, expectedErrorType = null) {
	const game = new Game();
	let ok = true;
	try {
		game.players[0].setDeck(deck);
		if (expectedErrorType !== null) {
			ok = false;
		}
	} catch (e) {
		if (!(e instanceof expectedErrorType)) {
			console.log("Unexpected Error while loading a deck:\n");
			console.log(e, e.stack);
			console.log("\n");
			ok = false;
		}
	}
	if (!ok) {
		console.error(`Deck Test '${name}' - FAIL`);
	}
}

// card constants
const stormWyvern = await fs.readFile("./cards/CUU00034.cdf", "utf8");
const willOTheWisp = await fs.readFile("./cards/CUU00048.cdf", "utf8");
const explosion = await fs.readFile("./cards/CUS00129.cdf", "utf8");
const lightTrickToken = `id: CUT00001
cardType: token
name: CUT00001
level: 0
types: Illusion, Light, Bug
attack: 0
defense: 0`;

// Test invalid input types
testDeck("Null Deck", null, err.DeckFormatError);
testDeck("Undefined Deck", undefined, err.DeckFormatError);
testDeck("String Deck", "test", err.DeckFormatError);

// Test invalid deck sizes
testDeck("30 Card Deck", new Array(30).fill(willOTheWisp), null);
testDeck("50 Card Deck", new Array(50).fill(willOTheWisp), null);
testDeck("Less than 30 Card Deck", new Array(29).fill(willOTheWisp), err.DeckSizeError);
testDeck("More than 50 Card Deck", new Array(51).fill(willOTheWisp), err.DeckSizeError);
testDeck("Empty Array Deck", [], err.DeckSizeError);

// Test deck with Tokens
testDeck("Deck with Tokens", new Array(30).fill(willOTheWisp).concat(lightTrickToken), err.DeckTokenError);

// Test deck with too many copies of a card
testDeck("Deck with too many Copies of 3-Copy Card", new Array(30).fill(willOTheWisp).concat(stormWyvern,stormWyvern,stormWyvern,stormWyvern), err.CardAmountError);
testDeck("Deck with too many Copies of 1-Copy Card", new Array(30).fill(willOTheWisp).concat(explosion,explosion), err.CardAmountError);