import AI from "./baseAI.mjs";

// AI system that does nothing except if it absolutely has to,
// kinda like myself sometimes... haha

export class PassiveAI extends AI {
	async selectMove(optionList, player) {
		// Pass if you can
		for (const option of optionList) {
			if (option.type === "pass") {
				return {type: "pass"};
			}
		}

		// Skip the battle phase
		if (optionList[0].type === "enterBattlePhase") {
			return {type: "enterBattlePhase", value: false};
		}

		// Just pick the first valid choice otherwise
		return {
			type: optionList[0].type,
			value: (await optionList[0].generateValidResponses().next()).value
		}
	}
}