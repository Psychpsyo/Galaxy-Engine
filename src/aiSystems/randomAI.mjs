import {AI} from "./baseAI.mjs";

// an AI that just picks random options at any possible time.
// NOT RECOMMENDED FOR ACTUAL GAMES, because:
// fully random Cross Universe is very unintuitive as stacks & blocks
// tend to be used in weird ways and attacks generally make no sense

export class RandomAI extends AI {
	async selectMove(optionList, player) {
		while (optionList.length > 0) {
			const request = optionList.splice(Math.floor(Math.random() * optionList.length), 1)[0];
			const responses = [];
			for (const response of request.generateResponses()) {
				responses.push(response);
			}
			if (responses.length === 0) continue;

			// determine a random, valid response
			const chosenResponse = {type: request.type};
			while (!("value" in chosenResponse) && responses.length > 0) {
				chosenResponse.value = responses.splice(Math.floor(Math.random() * responses.length), 1)[0];
				if ((await request.validate(chosenResponse)) !== "") {
					delete chosenResponse.value;
				}
			}
			if ("value" in chosenResponse) {
				return chosenResponse;
			}
		}
		// we didn't have a valid choice
		throw new Error("Random AI received no valid option!");
	}
}