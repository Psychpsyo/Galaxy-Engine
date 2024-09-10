// This runs all spell tests

import {promises as fs} from "fs";
import * as path from "path";
import {runTest} from "./lib.mjs";

const testDir = import.meta.dirname + "/scripts"
runTestsInDir(testDir);

async function runTestsInDir(dir) {
	const childPromises = [];
	for (let file of await fs.readdir(dir)) {
		const stat = await fs.stat(path.resolve(dir, file));
		file = `${dir}/${file}`;
		if (stat.isDirectory()) {
			childPromises.push(runTestsInDir(file))
		} else {
			childPromises.push(runTest(file.substring(testDir.length + 1, file.length - 4)));
		}
	}
	return Promise.all(childPromises);
}