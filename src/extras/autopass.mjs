// This module exports the getAutoResponse() function which the automatic simulator uses to figure out
// whether or not to automatically perform an action for the player, such as passing priority.

import * as phases from "../phases.mjs";
import * as abilities from "../abilities.mjs";
import * as ast from "../cdfScriptInterpreter/astNodes.mjs";
import * as blocks from "../blocks.mjs";
import * as modifiers from "../valueModifiers.mjs";
import {ScriptContext} from "../cdfScriptInterpreter/structs.mjs";

export function getAutoResponse(game, requests, {alwaysPass = false, useHiddenInfo = false, passOnOwnBlocks = false, passOnStackTwo = false, passInDrawPhase = false, passInBattlePhase = false, passInEndPhase = false}) {
	// non-pass actions
	if (requests.length == 1) {
		const request = requests[0];
		switch (request.type) {
			// activating mandatory trigger abilities (when they are the same, so the order probably doesn't matter)
			case "activateTriggerAbility": {
				const compareTo = request.eligibleAbilities[0];
				let autoSortable = true;
				for (let i = 1; i < request.eligibleAbilities.length; i++) {
					if (compareTo.id !== request.eligibleAbilities[i].id) {
						autoSortable = false;
					}
				}
				if (autoSortable) {
					return {
						type: "activateTriggerAbility",
						value: 0
					};
				}
				break;
			}
			// choosing the order of static abilities where it does not matter
			case "chooseAbilityOrder": {
				if (shouldStaticAbilitiesBeAutoOrdered(request.abilities)) {
					const response = [];
					for (let i = 0; i < request.abilities.length; i++) {
						response.push(i);
					}
					return {
						type: "chooseAbilityOrder",
						value: response
					}
				}
				break;
			}
			// If you want to just pass through everything, you want to skip ('pass through') the battle phase also
			case "enterBattlePhase": {
				if (alwaysPass) {
					return {
						type: "enterBattlePhase",
						value: false
					}
				}
				break;
			}
			// there is zero reason to not do your standard draw
			// TODO: some players may want to do it manually anyways
			case "doStandardDraw": {
				return {type: "doStandardDraw"}
			}
		}
	}

	// passing
	if (!requests.some(request => request.type === "pass")) return null;
	if (alwaysPass) return {type: "pass"};

	// passing on no real options (only retiring partners, casting spells from a selection of 0 and so on)
	let importantRequests = 0;
	for (const request of requests) {
		if (isImportant(request, game, passOnStackTwo, passInDrawPhase, passInBattlePhase, passInEndPhase)) {
			importantRequests++;
		}
	}
	const player = requests[0].player;
	if (importantRequests == 0 &&
		// Either using hidden info is allowed or the player's hand has no cards that are hidden from any other player
		(useHiddenInfo || !player.handZone.cards.some(card => {
			for (const hiddenFor of card.hiddenFor) {
				if (hiddenFor !== player) return true;
			}
			return false;
		}))) {
		return {type: "pass"};
	}

	// passing in response to your own actions
	if (passOnOwnBlocks) {
		const currentStack = game.currentStack();
		if (currentStack.index === 1 &&
			currentStack.blocks.length === 1 &&
			!currentStack.blocks.some(block => block.player !== requests[0].player) && // there is no opponent blocks
			!requests.some(request => request.type === "activateTriggerAbility") && // the responses are not trigger abilities
			!requests.some(request => request-type === "castSpell" && request.eligibleCards.some(isSpellItemTriggered)) // the responses are not triggered spells
		) {
			return {type: "pass"};
		}
	}

	return null;
}

// returns whether or not a request represents a meaningful choice for the player.
function isImportant(request, game, passOnStackTwo, passInDrawPhase, passInBattlePhase, passInEndPhase) {
	switch (request.type) {
		case "pass": {
			return false;
		}
		// being able to play 0 of a card is unimportant.
		case "doStandardSummon":
		case "deployItem":
		case "castSpell": {
			if (request.eligibleCards.length == 0) {
				return false;
			}
			break;
		}
		// retiring your partner is unimportant
		case "doRetire": {
			if (request.eligibleUnits.length == 1 && request.eligibleUnits[0].zone.type == "partner") {
				return false;
			}
			break;
		}
		// being able to activate 0 of a type of ability is unimportant
		case "activateOptionalAbility":
		case "activateFastAbility":
		case "activateTriggerAbility": {
			if (request.eligibleAbilities.length == 0) {
				return false;
			}
			break;
		}
	}

	// On stack 2, only trigger abilities and conditional spells are important
	const currentStack = game.currentStack();
	if (passOnStackTwo) {
		if (currentStack && currentStack.index > 1 && currentStack.blocks.length == 0) {
			if (request.type != "activateTriggerAbility" &&
				(request.type != "castSpell" || !request.eligibleCards.some(isSpellItemTriggered))
			) {
				return false;
			}
		}
	}

	// during the draw, battle, and end phase, only trigger abilities, conditional spells and attack declarations are important
	let currentPhase = game.currentPhase();
	if (currentStack.blocks.every(block => block instanceof blocks.StandardDraw) &&
		(((currentPhase instanceof phases.DrawPhase) && passInDrawPhase) ||
		((currentPhase instanceof phases.EndPhase) && passInEndPhase) ||
		((currentPhase instanceof phases.BattlePhase) && passInBattlePhase && currentStack.index === 1))
	) {
		switch (request.type) {
			case "activateTriggerAbility": {
				return true;
			}
			case "castSpell": {
				for (let card of request.eligibleCards) {
					for (let ability of card.values.current.abilities) {
						if (ability instanceof abilities.CastAbility) {
							if (ability.condition && hasPhaseEqualityCondition(ability.condition)) {
								return true;
							}
						}
					}
				}
				break;
			}
			case "doAttackDeclaration": {
				return true;
			}
		}
		return false;
	}
	return true;
}

function isSpellItemTriggered(card) {
	for (let ability of card.values.current.abilities) {
		if (ability instanceof abilities.CastAbility || ability instanceof abilities.DeployAbility) {
			if (ability.after || (ability.condition && hasTimeSensitiveCondition(ability.condition))) {
				return true;
			}
		}
	}
	return false;
}
// returns whether or not the abilities condition depends on the current phase or attacking units / attack target
function hasTimeSensitiveCondition(node) {
	if (!node) {
		return false;
	}
	if (node instanceof ast.CurrentPhaseNode || node instanceof ast.AttackersNode || node instanceof ast.AttackTargetNode) {
		return true;
	}
	for (let childNode of node.getChildNodes()) {
		if (hasTimeSensitiveCondition(childNode)) {
			return true;
		}
	}
	return false;
}

function hasPhaseEqualityCondition(node) {
	if (!node) {
		return false;
	}
	if (node instanceof ast.EqualsNode && (node.leftSide instanceof ast.CurrentPhaseNode || node.rightSide instanceof ast.CurrentPhaseNode)) {
		return true;
	}
	for (let childNode of node.getChildNodes()) {
		if (hasPhaseEqualityCondition(childNode)) {
			return true;
		}
	}
	return false;
}

function shouldStaticAbilitiesBeAutoOrdered(abilities) {
	const affectedProperties = [];
	for (const ability of abilities) {
		const player = ability.card.currentOwner();
		const modifier = ability.modifier.evalFull(new ScriptContext(ability.card, player, ability)).next().value.get(player);
		for (const modification of modifier.modifications) {
			// Mandatory action modifications should never be auto-ordered since their order would only be irrelevant if they did the >exact< same thing. (incredibly unlikely)
			if (modification instanceof modifiers.ActionModification) {
				if (ability.mandatory) return false;
				// Optional ones, however, can be seen as independent since the player can choose not to do the earlier ones in favour of the later ones. (hopefully, in most cases)
				// The only way they wouldn't be is if one ability would want to replace the action generated by another one. (highly unlikely)
				continue;
			}

			// if any two abilities modify the same property, they should not be auto-ordered.
			// TODO: make this check which direction the value is changed in. (i.e. order won't matter for two attack boosts)
			if (modification instanceof modifiers.ValueModification) {
				const affectedProperty = (modification.toBase? "base" : "") + modification.value;
				if (affectedProperties.includes(affectedProperty)) {
					return false;
				}
				continue;
			}
		}
	}
	return true;
}
