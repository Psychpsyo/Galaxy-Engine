// Running this file will iterate over all the replays in your errorReplays folder and rerun them.
// Any replays that do not error out anymore will be deleted.
// Use this to clean up after fixing a bug and figuring out if there is any others left.

import {promises as fs} from "fs";
import {Game} from "../../src/game.mjs";
import {InputRequest} from "../../src/inputRequests.mjs";
import {serializeState} from "./stateSerializer.mjs";

const testDir = import.meta.dirname
const promises = [];

async function evaluateReplay(filename, testType) {
	const replay = JSON.parse(await fs.readFile(`${testDir}/${testType}/${filename}`, "utf8"));
	const game = new Game();
	game.setReplay(replay);

	try  {
		for await (const updates of game.begin()) {
			if (updates[0] instanceof InputRequest) {
				// replay managed to run to 'completion' and can be deleted as it no longer errors.
				break;
			}
		}
	} catch(e) {
		if (testType === "invalid") {
			if (e.message !== replay.extra.expectedError) {
				console.log(`Test replay invalid/${filename} threw the wrong error.\nThrown:   ${e.message}\nExpected: ${replay.extra.expectedError}`);
			}
		} else {
			console.log(`Test replay ${testType}/${filename} errored when it shouldn't have: ${e.message}`);
		}
		return;
	}
	if (testType === "invalid") {
		console.log(`Test replay invalid/${filename} did not error when it should have.`);
	} else if (testType === "state") {
		const stateFilename = `${filename.substring(0, filename.lastIndexOf("."))}.state`;
		const expectation = await fs.readFile(`${testDir}/state/expectations/${stateFilename}`, "utf8").then((result) => result, () => "");
		const serialization = serializeState(game);
		if (serialization !== expectation) {
			await fs.writeFile(`${testDir}/state/failures/${stateFilename}`, serialization, "utf8");
			console.log(`Test replay state/${filename} ended in an incorrect game state. Incorrect state has been written to ${testDir}/state/failures/${stateFilename}`);
		}
	}
}

for (const testType of ["valid", "invalid", "state"]) {
	for (const file of await fs.readdir(`${testDir}/${testType}`)) {
		if (file.endsWith(".replay")) {
			promises.push(evaluateReplay(file, testType));
		}
	}
}

await Promise.all(promises);