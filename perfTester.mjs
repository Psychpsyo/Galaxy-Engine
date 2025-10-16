#!/usr/bin/env node
import profiler from "v8-profiler-next";
import fs from "fs";
const tests = [
	"./tests/spellTests/runAll.mjs",
	"./tests/replayTests/validateTestReplays.mjs",
	"./tests/allEffectsOneCard.mjs",
];
profiler.setGenerateType(1);

console.time("Time");
profiler.startProfiling("Run Test Cases");

const testPromises = [];
for (const test of tests) {
	testPromises.push(import(test));
}
await Promise.all(testPromises);

console.timeEnd("Time");

const profile = profiler.stopProfiling("Run Test Cases");
profile.export(function(_, result) {
  fs.writeFileSync("profile.cpuprofile", result);
  profile.delete();
});
