// Random math-y functions that are needed throughout the rules engine.

// returns all possible ways to choose k elements from a list of n elements.
export function nChooseK(n, k) {
	if (k > n) throw new Error("Cannot choose " + k + " elements from a list of " + n + ".");

	let choices = [];
	for (let i = k - 1; i >= 0; i--) {
		choices.push(i);
	}
	let combinations = [];

	combinations.push([...choices]);
	while (choices[choices.length - 1] < n - k) {
		for (let i = 0; i < k; i++) {
			if (choices[i] < n - 1 - i) {
				choices[i]++;
				for (let j = 1; j <= i; j++) {
					choices[i - j] = choices[i] + j;
				}
				combinations.push([...choices]);
				break;
			}
		}
	}
	return combinations;
}

// generates every possible combination [A1, A2, A3 ... Ax] so that An is from
// the n-th array that was passed in and x is the amount of input arrays.
export function cartesianProduct(arrays) {
	if (arrays.length == 0) {
		return [];
	}
	let products = arrays[0].map(elem => [elem]);
	for (let i = 1; i < arrays.length; i++) {
		let newProducts = [];
		for (const elemA of products) {
			for (const elemB of arrays[i]) {
				newProducts.push([...elemA, elemB]);
			}
		}
		products = newProducts;
	}
	return products;
}