#!/usr/bin/env node
const tests = [
	"./tests/validateCards.mjs",
	"./tests/testDeckLoading.mjs",
	"./tests/spellTests/runAll.mjs",
	"./tests/replayTests/validateTestReplays.mjs",
	"./tests/allEffectsOneCard.mjs",
];
const testPromises = [];
console.time("All tests run");
for (const test of tests) {
	testPromises.push(import(test));
}
await Promise.all(testPromises);
console.timeEnd("All tests run");
console.log("If there were any errors, they would show above.");