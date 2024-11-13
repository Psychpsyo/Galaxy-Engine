// Exports the runTest() function that is used to run a named spell test

import {writeFileSync, promises as fs} from "fs";
import {Game} from "../src/game.mjs";
import {PassiveAI} from "../src/aiSystems/passiveAI.mjs";

class NoMoreAbilitiesError extends Error {
	constructor() {
		super("The bot ran out of abilities to activate");
	}
}

// The AI for the starting player.
// It just activates all the abilities it can, as long as it can
class TestAI extends PassiveAI {
	#turnWeRanOut = 0;
	async selectMove(optionList, player) {
		const activateOptions = optionList.filter(option => ["activateOptionalAbility", "activateFastAbility", "activateTriggerAbility"].includes(option.type));
		for (const activatable of activateOptions) {
			if (activatable.eligibleAbilities.length > 0) {
				return {
					type: activatable.type,
					value: 0
				}
			}
		}
		const currentTurn = player.game.turns.length;
		if (currentTurn - this.#turnWeRanOut > 1) {
			throw new NoMoreAbilitiesError();
		}
		this.#turnWeRanOut = currentTurn;
		return super.selectMove(optionList, player);
	}
}
// Fake partner card that gives itself the effects of all your cards
const customPartner = `
id: CUU00000
cardType: unit
name: CUU00000
level: 0
types:
attack: 0
defense: 0

o: optional
$everything = VIEW([from you.deck]) + [from you.hand];
APPLY(thisCard, {abilities = $everything.abilities}, opponent.nextTurn.end);
`;
// APPLY(thisCard, {abilities = [from $everything where COUNT(abilities) = 0].abilities});

let deck = [customPartner];
for (const file of await fs.readdir("cards")) {
	deck.push(await fs.readFile("./cards/" + file, "utf8"));
}

const game = new Game();
game.config.upperDeckLimit = Infinity;
try {
	game.players[0].setDeck(deck);
	game.players[1].setDeck(deck);

	game.players[0].setPartner(0);
	game.players[1].setPartner(0);

	game.players[0].aiSystem = new TestAI();
	game.players[1].aiSystem = new PassiveAI();

	try {
		let eventCount = 0;
		for await (const _ of game.begin()) {
			eventCount++;
			if (eventCount % 100 === 0) {
				console.log(eventCount);
			}
			if (eventCount > 1000) {
				throw new Error();
			}
		}
		writeFileSync(`./errorReplays/allEffectsOnOneCard.replay`, JSON.stringify(game.replay));
	} catch (e) {
		if (!(e instanceof NoMoreAbilitiesError)) {
			game.replay.extra.crashReason = e.stack;
			writeFileSync(`./errorReplays/allEffectsOnOneCard.replay`, JSON.stringify(game.replay));
			console.log("allEffectsOneCard.mjs produced a rules engine error that has been dumped into /errorReplays");
		}
	}
} catch (e) {
	console.log(`allEffectsOneCard.mjs produced a rules engine error outside the game: ${e.message}`);
}
