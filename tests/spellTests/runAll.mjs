// This runs all spell tests

import {promises as fs} from "fs";
import * as path from "path";
import {runTest} from "./lib.mjs";
import {clearAbilityCache} from "../../src/cdfScriptInterpreter/interpreter.mjs"

const testDir = import.meta.dirname + "/scripts"
await runTestsInDir(testDir);

// must still run the tests one after the other to avoid race conditions around the ability cache
async function runTestsInDir(dir) {
	for (let file of await fs.readdir(dir)) {
		const stat = await fs.stat(path.resolve(dir, file));
		file = `${dir}/${file}`;
		if (stat.isDirectory()) {
			await runTestsInDir(file);
		} else {
			clearAbilityCache();
			await runTest(file.substring(testDir.length + 1, file.length - 4));
		}
	}
}