const tests = [
	"./tests/validateCards.mjs",
	"./tests/testDeckLoading.mjs",
	"./tests/spellTests/runAll.mjs",
	"./tests/replayTests/validateTestReplays.mjs",
	"./tests/allEffectsOneCard.mjs",
];
const testPromises = [];
for (const test of tests) {
	testPromises.push(import(test));
}
await Promise.all(testPromises);
console.log("All tests run.\nIf there were any errors, they would show above.");