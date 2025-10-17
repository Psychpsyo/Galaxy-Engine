// Random math-y functions that are needed throughout the rules engine.

// returns all possible ways to choose k elements from a list of n elements.
export function* nChooseK(n, k) {
	if (k > n) throw new Error("Cannot choose " + k + " elements from a list of " + n + ".");

	let choices = [];
	for (let i = k - 1; i >= 0; i--) {
		choices.push(i);
	}

	yield [...choices];
	while (choices.at(-1) < n - k) {
		for (let i = 0; i < k; i++) {
			if (choices[i] < n - 1 - i) {
				choices[i]++;
				for (let j = 1; j <= i; j++) {
					choices[i - j] = choices[i] + j;
				}
				yield [...choices];
				break;
			}
		}
	}
}

// generates every possible combination [A1, A2, A3 ... Ax] so that An is from
// the n-th generator that was passed in and x is the amount of input generators.
export function* cartesianProduct(generators) {
	if (generators.length == 0) {
		yield [];
		return;
	}

	const counters = new Array(generators.length);
	counters.fill(0);
	const seenValues = generators.map(generator => [generator.next(), generator.next()]);
	const product = seenValues.map(values => values[0].value);

	while (true) {
		yield [...product];
		counters[0]++;
		if (seenValues[0].length === counters[0] + 1 && !seenValues[0].at(-1).done)
			seenValues[0].push(generators[0].next());
		product[0] = seenValues[0][counters[0]].value;

		// do we need to increase the next counters?
		let i = 0;
		while (counters[i] === seenValues[i].length - 1 && seenValues[i].at(-1).done) {
			counters[i] = 0;
			product[i] = seenValues[i][0].value;
			i++;
			if (i === generators.length) {
				return;
			}
			counters[i]++;
			if (seenValues[i].length === counters[i] + 1 && !seenValues[i].at(-1).done)
				seenValues[i].push(generators[i].next());
			product[i] = seenValues[i][counters[i]].value;
		}
	}
}