import {parseScript} from "./parser.mjs";
import {tokenize} from "./lexer.mjs";
import * as abilities from "../abilities.mjs";

let registeredAbilities = {};

let alreadyParsed = {
	applyTarget: {},
	cardCondition: {},
	cardTurnLimit: {},
	condition: {},
	cost: {},
	during: {},
	equipableTo: {},
	exec: {},
	forPlayer: {},
	gameLimit: {},
	globalTurnLimit: {},
	modifier: {},
	trigger: {},
	triggerPrecondition: {},
	turnLimit: {},
	zoneDurationLimit: {}
};

// resets the above datastructures, invalidating any old results from parsing card abilities
export function clearAbilityCache() {
	registeredAbilities = [];
	for (const key in alreadyParsed) {
		alreadyParsed[key] = {};
	}
}

// ability is the information from the .cdf file, parsed into a js object.
export function registerAbility(ability) {
	registeredAbilities[ability.id] = ability;
}

// creates a new ability object for the specified ability ID
export function makeAbility(abilityId, game) {
	if (!(registeredAbilities.hasOwnProperty(abilityId))) {
		throw new Error("Trying to create unregistered ability " + abilityId + ".\nThe ability must first be registered with registerAbility().");
	}
	const ability = registeredAbilities[abilityId];
	switch (ability.type) {
		case "cast": {
			return new abilities.CastAbility(ability, game);
		}
		case "deploy": {
			return new abilities.DeployAbility(ability, game);
		}
		case "optional": {
			return new abilities.OptionalAbility(ability, game);
		}
		case "fast": {
			return new abilities.FastAbility(ability, game);
		}
		case "trigger": {
			return new abilities.TriggerAbility(ability, game);
		}
		case "static": {
			return new abilities.StaticAbility(ability, game);
		}
	}
}

export function buildAST(type, effectId, cdfScript, game) {
	if (!alreadyParsed[type][effectId]) {
		alreadyParsed[type][effectId] = parseScript(tokenize(cdfScript, effectId, game), effectId, type, cdfScript);
	}
	return alreadyParsed[type][effectId];
}