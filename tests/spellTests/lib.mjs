// Running this file will simulate some number of entirely random games where two bots
// make choices entirely at random, using randomly thrown-together decks.
// Use this to stress-test the rules engine and discover niche bugs that cause crashes.
// Note:
// This does nothing to validate the correctness of the rules engine or the cards.
// It can only be used to discover situations that cause errors to be thrown.

import {writeFileSync, promises as fs} from "fs";
import {Game} from "../../src/game.mjs";
import {PassiveAI} from "../../src/aiSystems/passiveAI.mjs";
import {CURandom} from "../../src/random.mjs";

// The AI for the starting player.
// It plays the test spell (CUS00000) at the start of the main phase and nothing else.
class SpellTestAI extends PassiveAI {
	async selectMove(optionList, player) {
		const spellOption = optionList.find(option => option.type === "castSpell");
		if (spellOption) {
			const spellIndex = spellOption.eligibleSpells.findIndex(spell => spell.cardId === "S00000");
			if (spellIndex >= 0) {
				return {
					type: "castSpell",
					value: spellIndex
				}
			}
		}
		return super.selectMove(optionList, player);
	}
}
// RNG that only ever produces 0.
class SpellTestRandom extends CURandom {
	async nextInt(range) {
		return 0;
	}
}
// The fake partner card
const spellTestUnit = `id: CUU00000
cardType: unit
name: CUU00000
level: 0
types:
attack: 0
defense: 0`;

export async function runTest(testName) {
	const game = new Game();
	game.config.lowerDeckLimit = 1;
	game.config.startingHandSize = 1;
	game.rng = new SpellTestRandom();

	game.players[0].setDeck([
		spellTestUnit,
`id: CUS00000
cardType: standardSpell
name: CUS00000
level: 0
types:

o: cast
condition: currentPhase = you.mainPhase
${await fs.readFile("./tests/spellTests/scripts/" + testName + ".cdf", "utf8")}
opponent.WINGAME();` // default failure
	]);
	game.players[1].setDeck([spellTestUnit, spellTestUnit]); // has two cards to not lose to an empty deck instantly

	// first card is the only guaranteed unit
	game.players[0].setPartner(0);
	game.players[1].setPartner(0);

	game.players[0].aiSystem = new SpellTestAI();
	game.players[1].aiSystem = new PassiveAI();

	try {
		for await (const _ of game.begin()) {}
		if (game.players[1].victoryConditions.length > 0) {
			console.log(`Spell Test '${testName}' failed!`);
		}
	} catch (e) {
		game.replay.extra.crashReason = e.stack;
		// needs to be sync, otherwise all the other in-progress games bog down the event loop and the file doesn't actually get written until the very end.
		writeFileSync(`./errorReplays/spellTest_${testName.replace("/", "_").replace("\\", "_")}.replay`, JSON.stringify(game.replay));
		console.log(`Spell Test '${testName}' produced a rules engine error that has been dumped into /errorReplays`);
	}
}