// Running this file will iterate over all the replays in your errorReplays folder and rerun them.
// Any replays that do not error out anymore will be deleted.
// Use this to clean up after fixing a bug and figuring out if there is any others left.

import {promises as fs} from "fs";
import {Game} from "../../src/game.mjs";
import {InputRequest} from "../../src/inputRequests.mjs";

const testDir = import.meta.dirname + "/invalid"
const promises = [];

async function evaluateReplay(filename) {
	const replay = JSON.parse(await fs.readFile(`${testDir}/${filename}`, "utf8"));
	const game = new Game();
	game.setReplay(replay);

	try  {
		for await (const updates of game.begin()) {
			if (updates[0] instanceof InputRequest) {
				// replay managed to run to 'completion' and can be deleted as it no longer errors.
				break;
			}
		}
		fs.unlink(`${testDir}/${filename}`);
	} catch(e) {
		if (e.message !== replay.extra.expectedError) {
			console.log(`Test replay ${filename} threw the wrong error.\nThrown:   ${e.message}\nExpected: ${replay.extra.expectedError}`);
		}
		return;
	}
	console.log(`Test replay ${filename} did not error when it should have.`);
}

for (const file of await fs.readdir(testDir)) {
	if (!file.endsWith(".replay")) continue;
	promises.push(evaluateReplay(file));
}

await Promise.all(promises);