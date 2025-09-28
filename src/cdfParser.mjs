import * as interpreter from "./cdfScriptInterpreter/interpreter.mjs";

export class CardParserError extends Error {
	constructor(message) {
		super(message);
		this.name = "CardParserError";
	}
}

export function parseCdfValues(cdf, game) {
	let data = {
		abilities: [],
		deckLimit: 3,
		equipableTo: "[from field where cardType = unit]",
		turnLimit: "any",
		condition: null
	};
	const lines = cdf.replaceAll("\r", "").split("\n");
	let inAbility = false;
	let abilitySection = "";
	let abilityCount = 0;
	let subAbilityCount = 0;
	for (let line of lines) {
		if (line === "") {
			continue;
		}
		let parts = line.split(/:(.*)/).map(part => part.trim());
		if (inAbility && parts[0] != "o") {
			let ability = data.abilities.at(-1);
			switch (parts[0]) {
				case "cancellable": {
					if (!["yes", "no"].includes(parts[1])) {
						throw new CardParserError("CDF Parser Error: 'cancellable' must be either 'yes' or 'no'.");
					}
					ability.cancellable = parts[1] === "yes";
					break;
				}
				case "turnLimit": {
					ability.turnLimit = parts[1];
					break;
				}
				case "globalTurnLimit": {
					ability.globalTurnLimit = parts[1];
					break;
				}
				case "gameLimit": {
					ability.gameLimit = parts[1];
					break;
				}
				case "zoneDurationLimit": {
					ability.zoneDurationLimit = parts[1];
					break;
				}
				case "condition": {
					ability.condition = parts[1];
					break;
				}
				case "after": {
					if (!["trigger", "cast"].includes(ability.type)) {
						throw new CardParserError("CDF Parser Error: " + ability.type + " abilities can't have an 'after' clause.");
					}
					if (ability.during) {
						throw new CardParserError("CDF Parser Error: 'after' and 'during' clauses are mutually exclusive. Use a condition instead of the during.");
					}
					ability.after = parts[1];
					break;
				}
				case "afterPrecondition": {
					if (!["trigger", "cast"].includes(ability.type)) {
						throw new CardParserError("CDF Parser Error: " + ability.type + " abilities can't have an 'afterPrecondition' clause.");
					}
					if (ability.during) {
						throw new CardParserError("CDF Parser Error: 'afterPrecondition' and 'during' clauses are mutually exclusive. Use a condition instead of the during.");
					}
					ability.afterPrecondition = parts[1];
					break;
				}
				case "during": {
					if (ability.type != "trigger") {
						throw new CardParserError("CDF Parser Error: Only trigger abilities have phase restrictions.");
					}
					if (ability.after) {
						throw new CardParserError("CDF Parser Error: 'after' and 'during' clauses are mutually exclusive. Use a condition instead of the during.");
					}
					ability.during = parts[1];
					break;
				}
				case "mandatory": {
					if (!["trigger", "static"].includes(ability.type)) {
						throw new CardParserError("CDF Parser Error: Only static or trigger abilities can be mandatory.");
					}
					if (!["yes", "no"].includes(parts[1])) {
						throw new CardParserError("CDF Parser Error: 'mandatory' must be either 'yes' or 'no'.");
					}
					ability.mandatory = parts[1] === "yes";
					break;
				}
				case "cost": {
					abilitySection = "cost";
					ability.cost = "";
					break;
				}
				case "exec": {
					abilitySection = "exec";
					ability.exec = "";
					break;
				}
				case "onComplete": {
					abilitySection = "onComplete";
					ability.onComplete = "";
					break;
				}
				case "applyTo": {
					if (ability.type != "static") {
						throw new CardParserError("CDF Parser Error: Only static abilities have a 'applyTo' clause.");
					}
					ability.applyTo = parts[1];
					break;
				}
				case "modifier": {
					if (ability.type != "static") {
						throw new CardParserError("CDF Parser Error: Only static abilities have a 'modifier' clause.");
					}
					ability.modifier = parts[1];
					break;
				}
				case "forPlayer": {
					ability.forPlayer = parts[1];
					break;
				}
				case "|o": { // sub-ability
					if (!["optional", "fast", "trigger", "static", "part"].includes(parts[1])) {
						throw new CardParserError("CDF Parser Error: " + parts[1] + " is an invalid sub-ability type.");
					}
					subAbilityCount++;
					data.abilities.push({
						id: data.id + ":" + abilityCount + ":" + subAbilityCount,
						isSubAbility: true,
						type: parts[1],
						cancellable: true,
						forPlayer: "you",
						turnLimit: "any",
						globalTurnLimit: "any",
						gameLimit: "any",
						zoneDurationLimit: "any",
						during: null,
						after: null,
						afterPrecondition: null,
						condition: null,
						exec: "",
						applyTo: "",
						modifier: ""
					});
					abilitySection = "exec";
					break;
				}
				default: {
					if (ability[abilitySection].length > 0) {
						ability[abilitySection] += "\n";
					}
					ability[abilitySection] += line;
				}
			}
			continue;
		}
		switch(parts[0]) {
			case "id": {
				data.id = parts[1].substring(2);
				break;
			}
			case "cardType": {
				if (!["unit", "token", "standardSpell", "continuousSpell", "enchantSpell", "standardItem", "continuousItem", "equipableItem"].includes(parts[1])) {
					throw new CardParserError("CDF Parser Error: " + parts[0] + " is an invalid card type.");
				}
				data.cardType = parts[1];
				break;
			}
			case "name": {
				data.name = parts[1].substring(2);
				break;
			}
			case "level": {
				data.level = parseInt(parts[1]);
				break;
			}
			case "types": {
				data.types = parts[1].split(",").map(type => type.trim()).filter(type => type != "");
				break;
			}
			case "attack": {
				data.attack = parseInt(parts[1]);
				break;
			}
			case "defense": {
				data.defense = parseInt(parts[1]);
				break;
			}
			case "deckLimit": {
				data.deckLimit = parts[1] === "any"? Infinity : parseInt(parts[1]);
				break;
			}
			case "equipableTo": {
				data.equipableTo = "[from field where cardType = unit & " + parts[1] + "]";
				break;
			}
			case "turnLimit": {
				data.turnLimit = parts[1];
				break;
			}
			case "condition": {
				data.condition = parts[1];
				break;
			}
			case "o": {
				inAbility = true;
				abilitySection = "exec";
				subAbilityCount = 0;
				// this is only supported to instantiate tokens, not actually a part of cdf files.
				if (parts[1].startsWith("CU")) {
					data.abilities.push(parts[1].substring(2));
					break;
				}
				if (!["cast", "deploy", "optional", "fast", "trigger", "static"].includes(parts[1])) {
					throw new CardParserError("CDF Parser Error: " + parts[1] + " is an invalid ability type.");
				}
				if (parts[1] === "cast" && !["standardSpell", "continuousSpell", "enchantSpell"].includes(data.cardType)) {
					throw new CardParserError("CDF Parser Error: Only spells can have cast abilities.");
				}
				if (parts[1] === "deploy" && !["standardItem", "continuousItem", "equipableItem"].includes(data.cardType)) {
					throw new CardParserError("CDF Parser Error: Only items can have deploy abilities.");
				}
				abilityCount++;
				data.abilities.push({
					id: data.id + ":" + abilityCount,
					isSubAbility: false,
					type: parts[1],
					cancellable: true,
					forPlayer: "you",
					turnLimit: "any",
					globalTurnLimit: "any",
					gameLimit: "any",
					zoneDurationLimit: "any",
					during: null,
					after: null,
					afterPrecondition: null,
					condition: null,
					exec: "",
					applyTo: "",
					modifier: ""
				});
				break;
			}
			default: {
				throw new CardParserError("CDF Parser Error: " + parts[0] + " is not a valid card attribute.");
			}
		}
	}
	for (const ability of data.abilities) {
		if (typeof ability !== "string") {
			interpreter.registerAbility(ability);
			// part abilities must have their exec AST built before they can be used
			if (ability.type === "part") {
				interpreter.buildAST("exec", ability.id, ability.exec, game);
			}
		}
	}
	// sub abilities just needed to be registered, they can now be filtered out
	data.abilities = data.abilities.filter(ability => !ability.isSubAbility).map(ability => typeof ability === "string"? ability : ability.id);
	return data;
}