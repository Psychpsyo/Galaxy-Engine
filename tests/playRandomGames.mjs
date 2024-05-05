// Running this file will simulate some number of entirely random games where two bots
// make choices entirely at random, using randomly thrown-together decks.
// Use this to stress-test the rules engine and discover niche bugs that cause crashes.
// Note:
// This does nothing to validate the correctness of the rules engine or the cards.
// It can only be used to discover situations that cause errors to be thrown.

import {writeFileSync, promises as fs} from "fs";
import {Game} from "../src/game.mjs";
import {RandomAI} from "../src/aiSystems/randomAI.mjs";

const randomAI = new RandomAI();

const allCards = [];
const allUnits = [];

const gamePromises = [];
let finishedGames = 0;

for (const file of await fs.readdir("cards")) {
	const cdf = await fs.readFile("./cards/" + file, "utf8");
	allCards.push(cdf);
	// quick and dirty check for if it's a unit
	if (file[2] === "U") {
		allUnits.push(cdf);
	}
}

// Makes a random deck.
// The first card is guaranteed to always be a unit.
function makeRandomDeck() {
	// one random unit
	const deck = [allUnits[Math.floor(Math.random() * allUnits.length)]];
	// and 29 - 49 other random cards
	const cardCount = 29 + Math.floor(Math.random() * 20);
	for (let i = 0; i < cardCount; i++) {
		let card;
		do {
			card = allCards[Math.floor(Math.random() * allCards.length)];
		} while (deck.includes(card)); // no duplicates allowed
		deck.push(card);
	}
	return deck;
}

async function runGame() {
	const game = new Game();
	const deck1 = makeRandomDeck();
	const deck2 = makeRandomDeck();

	game.players[0].setDeck(deck1);
	game.players[1].setDeck(deck2);

	// first card is the only guaranteed unit
	game.players[0].setPartner(0);
	game.players[1].setPartner(0);

	game.players[0].aiSystem = randomAI;
	game.players[1].aiSystem = randomAI;

	let eventCount = 0;
	try {
		for await (const _ of game.begin()) {
			// the AIs might've gotten stuck somehow.
			// probably not a failure case, just some weird combo or a bunch of abilities that they can keep activating
			if (eventCount++ > 10_000) {
				break;
			}
		}
		finishedGames++;
	} catch (e) {
		finishedGames++;
		// needs to be sync, otherwise all the other in-progress games bog down the event loop and the file doesn't actually get written until the very end.
		writeFileSync(`./errorReplays/game${finishedGames}_${Math.floor(Math.random() * 100000000)}.replay`, JSON.stringify(game.replay));
	}

	process.stdout.clearLine();
	process.stdout.cursorTo(0);
	process.stdout.write(`${finishedGames}/${gamePromises.length}`);
}

const gameCount = parseInt(process.argv[2] ?? 1);
console.log(`Playing ${gameCount} game${gameCount === 1? "" : "s"}...`);
for (let i = 0; i < gameCount; i++) {
	gamePromises.push(runGame());
}
process.stdout.write(`${finishedGames}/${gamePromises.length}`);
await Promise.all(gamePromises);
console.log("\nDone!");