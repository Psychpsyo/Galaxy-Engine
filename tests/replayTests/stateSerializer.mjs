function serializeObjectValues(object, indent) {
	let serialization = "";
	for (const type of ["base", "current"]) {
		serialization += `${indent}${type}:\n`;
		for (const [key, value] of Object.entries(object.values[type])) {
			if (key === "abilities") {
				serialization += `${indent}\tabilities:${value.map(ability => `\n${indent}\t\t${ability.id}${ability.isCancelled? " (cancelled)" : ""}`).join("")}\n`;
				continue;
			}
			serialization += `${indent}\t${key}: ${Array.isArray(value)? value.join(", ") : value}\n`;
		}
	}
	serialization += `${indent}modifiers:${object.values.modifierStack.length === 0? "none" : ""}\n`;
	for (const [i, modifier] of object.values.modifierStack.entries()) {
		serialization += `${indent}\tmodifier #${i}:\n`;
		for (const modification of modifier.modifications) {
			serialization += `${indent}\t\t${modification.toBase? "base " : ""}${modification.value}\n`;
		}
	}
	return serialization;
}

export function serializeState(game) {
	let state = "";
	for (const player of game.players) {
		state += `Player #${player.index}:
	mana: ${player.mana}
	life: ${player.life}
	victoryConditions: ${player.victoryConditions.join(", ") || "none"}
	values:
${serializeObjectValues(player, "\t\t")
}	zones:
		deck:
			${player.deckZone.cards.map(card => card.cardId).join("\n\t\t\t")}\n`;
		for (const zone of ["partnerZone", "handZone", "unitZone", "spellItemZone", "discardPile", "exileZone"]) {
			state += `\t\t${zone}:\n`;
			if (player[zone].cards.length === 0) {
				state += `\t\t\t---\n`;
				continue;
			}
			for (const card of player[zone].cards) {
				if (!card) {
					state += `\t\t\t---\n`;
					continue;
				}
				state += `\t\t\t${card.cardId}:\n`;
				if (zone !== "handZone")
					state += `\t\t\t\towner: #${card.owner.index}\n`;
				if (card.hiddenFor.length > 0) {
					state += `\t\t\t\thiddenFor: ${card.hiddenFor.map(p => `#${p.index}`).join(", ")}\n`;
				} else if (zone === "handZone") {
					state += `\t\t\t\thiddenFor: ---\n`;
				}
				// Don't need all the other values for hand cards
				if (zone === "handZone") continue;
				let propsToLog = ["isToken"];
				if (["unitZone", "partnerZone"].includes(zone))
					propsToLog = propsToLog.concat(["attacksMadeThisTurn", "canAttackAgain", "isAttackTarget", "isAttacking"]);
				for (const cardProp of propsToLog) {
					state += `\t\t\t\t${cardProp}: ${card[cardProp]}\n`;
				}
				if (card.lastFieldSidePlayer)
					state += `\t\t\t\tlastFieldSidePlayer: #${card.lastFieldSidePlayer.index}\n`;
				state += `\t\t\t\tvalues:\n${serializeObjectValues(card, "\t\t\t\t\t")}`;
			}
		}
	}
	return state;
}