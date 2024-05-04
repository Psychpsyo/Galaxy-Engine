import {promises as fs} from "fs";
import {Game} from "../src/game.mjs";
import {RandomAI} from "../src/aiSystems/randomAI.mjs";

const randomAI = new RandomAI();
const allCards = [];
const allUnits = [];
let finishedGames = 0;
for (const file of await fs.readdir("cards")) {
	const cdf = await fs.readFile("./cards/" + file, "utf8");
	allCards.push(cdf);
	// quick and dirty check for if it's a unit
	if (file[2] === "U") {
		allUnits.push(cdf);
	}
}

// Makes a ranom deck.
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

	const generator = game.begin();
	let eventCount = 0;
	try {
		for await (const _ of generator) {
			// the AIs might've gotten stuck somehow.
			// probably not a failure case, just some weird combo or a bunch of abilities that they can keep activating
			if (eventCount++ > 10_000) {
				//break;
			}
		}
	} catch (e) {
		finishedGames++;
		console.log(`Game ${finishedGames} finished with error.`);
		await fs.writeFile(`./errorReplays/game${finishedGames}_${Math.floor(Math.random() * 100000000)}.replay`, JSON.stringify(game.replay), "utf8");
		return;
	}
	console.log(`Game ${++finishedGames} finished normally.`);
}


const gameCount = parseInt(process.argv[2] ?? 1);
console.log(`Starting ${gameCount} game${gameCount === 1? "" : "s"}...`);
for (let i = 0; i < gameCount; i++) {
	runGame();
}