// Running this file will iterate over all the replays inside of your errorReplays folder
// and tally up how many times every card appears in it.
// Once done, it'll log all of the counts to your console. Use this to figure out which
// card(s) might be involved in the breakage.

import {promises as fs} from "fs";
import {Game} from "../src/game.mjs";

const promises = [];
const cardCount = {
	// cards go in here like this: "CUU00161": 4
};

async function analyzeReplay(filename) {
	const replay = JSON.parse(await fs.readFile("./errorReplays/" + filename, "utf8"));
	const game = new Game();
	game.setReplay(replay);

	for (const card of game.getAllCards()) {
		cardCount[card.cardId] = (cardCount[card.cardId] ?? 0) + 1;
	}
}

for (const file of await fs.readdir("errorReplays")) {
	if (!file.endsWith(".replay")) {
		console.log(`Skipping ${file}`);
		continue;
	}
	promises.push(analyzeReplay(file));
}
await Promise.all(promises);

let rankings = Object.entries(cardCount).sort((a, b) => a[1] - b[1]);
for (const ranking of rankings) {
	console.log(`${ranking[0]}: ${ranking[1]}`);
}