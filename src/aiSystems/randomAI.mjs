import {AI} from "./ai.mjs";
import * as requests from "../inputRequests.mjs";

// an AI that just picks random options at any possible time.
// NOT RECOMMENDED FOR ACTUAL GAMES because:
// fully random Cross Universe is very unintuitive as stacks & blocks
// tend to be used in weird ways and attacks generally make no sense

export class RandomAI extends AI {
	async selectMove(optionList, player) {
		while (optionList.length > 0) {
			const option = optionList.splice(Math.floor(Math.random() * optionList.length), 1)[0];
			const responses = [];
			for (const response of requests[option.type].generateValidResponses(option)) {
				responses.push(response);
			}
			if (responses.length === 0) continue;
			return {
				type: option.type,
				value: responses[Math.floor(Math.random() * responses.length)]
			};
		}
		// we didn't have a valid choice
		throw new Error("Random AI received no valid option!");
	}
}