// Running this file will iterate over all the replays in your errorReplays folder and rerun them.
// Any replays that do not error out anymore will be deleted.
// Use this to clean up after fixing a bug and figuring out if there is any others left.

import {promises as fs} from "fs";
import {Game} from "../src/game.mjs";
import {InputRequest} from "../src/inputRequests.mjs";

const promises = [];
let finishedPromises = 0;
let deletedReplayCount = 0;

async function evaluateReplay(filename) {
	const replay = JSON.parse(await fs.readFile("./errorReplays/" + filename, "utf8"));
	const game = new Game();
	game.setReplay(replay);

	try  {
		for await (const updates of game.begin()) {
			if (updates[0] instanceof InputRequest) {
				// replay managed to run to 'completion' and can be deleted as it no longer errors.
				fs.unlink("./errorReplays/" + filename);
				deletedReplayCount++;
			}
		}
	} catch(e) {
		// replay is still broken, do nothing
	}

	finishedPromises++;
	process.stdout.clearLine();
	process.stdout.cursorTo(0);
	process.stdout.write(`${finishedPromises}/${promises.length} (${deletedReplayCount} deleted)`);
}

for (const file of await fs.readdir("errorReplays")) {
	if (!file.endsWith(".replay")) {
		console.log(`Skipping ${file}`);
		continue;
	}
	promises.push(evaluateReplay(file));
}

console.log("Re-running all error replays...");
process.stdout.write(`${finishedPromises}/${promises.length} (${deletedReplayCount} deleted)`);
await Promise.all(promises);
console.log("\nDone!");