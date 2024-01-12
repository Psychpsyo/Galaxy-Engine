// This file input request definitions for passing out of the engine
import {DeckPosition} from "./cdfScriptInterpreter/structs.js";
import {nChooseK} from "./math.js";

export const chooseCards = {
	create: function(player, cards, validAmounts, reason, validate = () => true) {
		return {
			"nature": "request",
			"player": player,
			"type": "chooseCards",
			"from": cards,
			"validAmounts": validAmounts,
			"reason": reason,
			"validate": validate
		}
	},
	validate: function(response, request) {
		// If a valid amount could have been selected, it should have been selected.
		// Otherwise, all available cards should have been selected.
		if (request.from.length > 0 && (
			request.validAmounts.length === 0 || request.validAmounts.some(amount => amount <= request.from.length)
		)) {
			if (!request.validAmounts.includes(response.length) && request.validAmounts.length > 0) {
				console.log(response, request);
				throw new Error("Chose invalid amount of cards.");
			}
		} else if (response.length != request.from.length) {
			throw new Error("Chose invalid amount of cards.");
		}
		for (let cardIndex of response) {
			if (cardIndex < 0 || cardIndex >= request.from.length) {
				throw new Error("Chose an invalid card index: " + cardIndex);
			}
		}
		const cards = response.map(cardIndex => request.from[cardIndex]);
		if (!request.validate(cards)) {
			throw new Error("Card selection did not satisfy validator function.");
		}
		return cards;
	},
	generateValidResponses: function(request) {
		const combinations = [];
		// we need to account for an empty list representing 'any amount'
		const validAmounts = request.validAmounts;
		if (validAmounts.length === 0) {
			for (let i = 1; i <= request.from.length; i++) {
				validAmounts.push(i);
			}
		}
		for (const amount of validAmounts) {
			if (amount > request.from.length) {
				continue;
			}
			for (const newCombination of nChooseK(request.from.length, amount)) {
				if (request.validate(newCombination.map(cardIndex => request.from[cardIndex]))) {
					combinations.push(newCombination);
				}
			}
		}
		return combinations;
	}
}

export const choosePlayer = {
	create: function(player, reason) {
		return {
			"nature": "request",
			"player": player,
			"type": "choosePlayer",
			"reason": reason
		}
	},
	validate: function(response, request) {
		if (response < 0 || response >= request.player.game.players.length) {
			throw new Error("Chose an invalid player index: " + response);
		}
		return request.player.game.players[response];
	},
	generateValidResponses: function(request) {
		return [0, 1];
	}
}

export const chooseType = {
	create: function(player, effect, types) {
		return {
			"nature": "request",
			"player": player,
			"type": "chooseType",
			"effect": effect,
			"from": types
		}
	},
	validate: function(response, request) {
		if (response < 0 || response >= request.from.length) {
			throw new Error("Chose an invalid type index: " + response);
		}
		return request.from[response];
	},
	generateValidResponses: function(request) {
		let options = [];
		for (let i = 0; i < request.from.length; i++) {
			options.push(i);
		}
		return options;
	}
}

export const chooseDeckSide = {
	create: function(player, effect, deckOwner) {
		return {
			"nature": "request",
			"player": player,
			"type": "chooseDeckSide",
			"effect": effect,
			"deckOwner": deckOwner
		}
	},
	validate: function(response, request) {
		if (response != "top" && response != "bottom") {
			throw new Error("Chose an invalid deck side: " + response + " (must be either 'top' or 'bottom')");
		}
		return new DeckPosition([request.player.deckZone], response === "top");
	},
	generateValidResponses: function(request) {
		return [new DeckPosition([request.player.deckZone], true), new DeckPosition([request.player.deckZone], false)];
	}
}

export const orderCards = {
	create: function(player, cards, reason) {
		return {
			"nature": "request",
			"player": player,
			"type": "orderCards",
			"cards": cards,
			"reason": reason
		}
	},
	validate: function(response, request) {
		if (response.length != request.cards.length) {
			throw new Error("Supplied an incorrect amount of cards to order. Got " + response.length + " when it should have been between " + request.cards.length + ".");
		}
		let sortedResponse = response.toSorted();
		for (let i = 0; i < response.length; i++) {
			if (i != sortedResponse[i]) {
				throw new Error("Supplied incorrect card ordering indices. Got a " + sortedResponse[i] + " when there should have been a " + i + ".");
			}
		}
		return response.map(cardIndex => request.cards[cardIndex]);
	},
	generateValidResponses: function(request) {
		return nChooseK(request.cards.length, request.cards.length);
	}
}

export const applyActionModificationAbility = {
	create: function(player, ability, target) {
		return {
			"nature": "request",
			"player": player,
			"type": "applyActionModificationAbility",
			"ability": ability,
			"target": target
		}
	},
	validate: function(response, request) {
		if (typeof response !== "boolean") {
			throw new Error("Supplied an incorrect response value. Expected a Boolean but got '" + (typeof response) + "' instead.");
		}
		return response;
	}
}

export const enterBattlePhase = {
	create: function(player) {
		return {
			"nature": "request",
			"player": player,
			"type": "enterBattlePhase"
		}
	},
	validate: function(response, request) {
		return response;
	}
}

// pass on block creation
export const pass = {
	create: function(player) {
		return {
			"nature": "request",
			"player": player,
			"type": "pass"
		}
	},
	validate: function(response, request) {
		return response;
	}
}

export const doStandardDraw = {
	create: function(player) {
		return {
			"nature": "request",
			"player": player,
			"type": "doStandardDraw"
		}
	},
	validate: function(response, request) {
		return response;
	}
}

export const doStandardSummon = {
	create: function(player, eligibleUnits) {
		return {
			"nature": "request",
			"player": player,
			"type": "doStandardSummon",
			"eligibleUnits": eligibleUnits
		}
	},
	validate: function(response, request) {
		if (response < 0 || response >= request.player.handZone.cards.length) {
			throw new Error("Supplied out-of-range hand card index for a standard summon.");
		}
		if (!request.eligibleUnits.includes(request.player.handZone.cards[response])) {
			throw new Error("Tried to standard summon a non-eligible unit.");
		}
		return response;
	}
}

export const deployItem = {
	create: function(player, eligibleItems) {
		return {
			"nature": "request",
			"player": player,
			"type": "deployItem",
			"eligibleItems": eligibleItems
		}
	},
	validate: function(response, request) {
		if (response < 0 || response >= request.player.handZone.cards.length) {
			throw new Error("Supplied out-of-range hand card index for deploying an item.");
		}
		if (!request.eligibleItems.includes(request.player.handZone.cards[response])) {
			throw new Error("Tried to deploy a non-eligible item.");
		}
		return response;
	}
}

export const castSpell = {
	create: function(player, eligibleSpells) {
		return {
			"nature": "request",
			"player": player,
			"type": "castSpell",
			"eligibleSpells": eligibleSpells
		}
	},
	validate: function(response, request) {
		if (response < 0 || response >= request.player.handZone.cards.length) {
			throw new Error("Supplied out-of-range hand card index for casting a spell.");
		}
		if (!request.eligibleSpells.includes(request.player.handZone.cards[response])) {
			throw new Error("Tried to cast a non-eligible spell.");
		}
		return response;
	}
}

export const doAttackDeclaration = {
	create: function(player, eligibleUnits) {
		return {
			"nature": "request",
			"player": player,
			"type": "doAttackDeclaration",
			"eligibleUnits": eligibleUnits
		}
	},
	validate: function(response, request) {
		for (let cardIndex of response) {
			if (cardIndex < 0 || cardIndex >= request.eligibleUnits.length) {
				throw new Error("Chose an invalid attacker index for attack declaration: " + cardIndex);
			}
		}
		response = response.map(cardIndex => request.eligibleUnits[cardIndex]);
		if (response.length > 1) {
			let partner = response.find(card => card.zone.type == "partner");
			if (!partner) {
				throw new Error("Tried to peform a combined attack without declaring the partner to attack.");
			}
			for (let unit of response) {
				if (!unit.sharesTypeWith(partner)) {
					throw new Error("Tried to peform a combined attack where some participants do not share a type with the partner.");
				}
			}
		}

		return response;
	}
}

export const doFight = {
	create: function(player) {
		return {
			"nature": "request",
			"player": player,
			"type": "doFight"
		}
	},
	validate: function(response, request) {
		return response;
	}
}

export const doRetire = {
	create: function(player, eligibleUnits) {
		return {
			"nature": "request",
			"player": player,
			"type": "doRetire",
			"eligibleUnits": eligibleUnits
		}
	},
	validate: function(response, request) {
		for (let cardIndex of response) {
			if (cardIndex < 0 || cardIndex >= request.eligibleUnits.length) {
				throw new Error("Chose an invalid unit retire index: " + cardIndex);
			}
		}
		return response.map(cardIndex => request.eligibleUnits[cardIndex]);
	}
}

export const activateOptionalAbility = {
	create: function(player, eligibleAbilities) {
		return {
			"nature": "request",
			"player": player,
			"type": "activateOptionalAbility",
			"eligibleAbilities": eligibleAbilities
		}
	},
	validate: function(response, request) {
		if (response < 0 || response >= request.eligibleAbilities.length) {
			throw new Error("Supplied out-of-range ability index for activating an optional ability.");
		}
		return request.eligibleAbilities[response];
	}
}

export const activateFastAbility = {
	create: function(player, eligibleAbilities) {
		return {
			"nature": "request",
			"player": player,
			"type": "activateFastAbility",
			"eligibleAbilities": eligibleAbilities
		}
	},
	validate: function(response, request) {
		if (response < 0 || response >= request.eligibleAbilities.length) {
			throw new Error("Supplied out-of-range ability index for activating a fast ability.");
		}
		return request.eligibleAbilities[response];
	}
}

export const activateTriggerAbility = {
	create: function(player, eligibleAbilities) {
		return {
			"nature": "request",
			"player": player,
			"type": "activateTriggerAbility",
			"eligibleAbilities": eligibleAbilities
		}
	},
	validate: function(response, request) {
		if (response < 0 || response >= request.eligibleAbilities.length) {
			throw new Error("Supplied out-of-range ability index for activating a trigger ability.");
		}
		return request.eligibleAbilities[response];
	}
}

export const chooseZoneSlot = {
	create: function(player, zone, eligibleSlots) {
		return {
			"nature": "request",
			"player": player,
			"type": "chooseZoneSlot",
			"zone": zone,
			"eligibleSlots": eligibleSlots
		}
	},
	validate: function(response, request) {
		if (response < 0 || response >= request.eligibleSlots.length) {
			throw new Error("Supplied out-of-range zone slot index '" + response + "'. It should have been between 0 and " + request.eligibleSlots.length + ".");
		}
		return request.eligibleSlots[response];
	},
	generateValidResponses: function(request) {
		let options = [];
		for (let i = 0; i < request.eligibleSlots.length; i++) {
			options.push(i);
		}
		return options;
	}
}

export const chooseAbilityOrder = {
	create: function(player, card, abilities) {
		return {
			"nature": "request",
			"player": player,
			"type": "chooseAbilityOrder",
			"abilities": abilities,
			"applyTo": card
		}
	},
	validate: function(response, request) {
		if (response.length != request.abilities.length) {
			throw new Error("Supplied incorrect amount of abilities to order. Got " + response.length + " when it should have been between " + request.abilities.length + ".");
		}
		let sortedResponse = response.toSorted();
		for (let i = 0; i < response.length; i++) {
			if (i != sortedResponse[i]) {
				throw new Error("Supplied incorrect ability ordering indices. Got a " + sortedResponse[i] + " when there should have been a " + i + ".");
			}
		}
		return response;
	},
	generateValidResponses: function(request) {
		return nChooseK(request.abilities.length, request.abilities.length);
	}
}

export const selectTokenAmount = {
	create: function(player, eligibleAmounts) {
		return {
			"nature": "request",
			"player": player,
			"type": "selectTokenAmount",
			"eligibleAmounts": eligibleAmounts
		}
	},
	validate: function(response, request) {
		if (!request.eligibleAmounts.includes(response)) {
			throw new Error("Supplied incorrect amount of tokens to summon. Got " + response + " when it should have been between any of these: " + request.eligibleAmounts);
		}
		return response;
	},
	generateValidResponses: function(request) {
		return request.eligibleAmounts;
	}
}