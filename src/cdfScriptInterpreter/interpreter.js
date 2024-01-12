import {parseScript} from "./parser.js";
import {tokenize} from "./lexer.js";
import * as abilities from "../abilities.js";

let registeredAbilities = {};

let alreadyParsed = {
	applyTarget: {},
	cardCondition: {},
	condition: {},
	cost: {},
	during: {},
	equipableTo: {},
	exec: {},
	gameLimit: {},
	zoneDurationLimit: {},
	globalTurnLimit: {},
	modifier: {},
	trigger: {},
	turnLimit: {}
};

// ability is the information from the .cdf file, parsed into a js object.
export function registerAbility(ability) {
	registeredAbilities[ability.id] = ability;
}

// creates a new ability object for the specified ability ID
export function makeAbility(abilityId, game) {
	if (!(registeredAbilities.hasOwnProperty(abilityId))) {
		throw new Error("Trying to create unregistered ability " + abilityId + ".\nThe ability must first be registered with registerAbility().");
	}
	let ability = registeredAbilities[abilityId];
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

export function buildAST(type, id, cdfScript, game) {
	if (!alreadyParsed[type][id]) {
		alreadyParsed[type][id] = parseScript(tokenize(cdfScript, id, game), id, type, cdfScript);
	}
	return alreadyParsed[type][id];
}