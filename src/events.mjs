// event definitions to be passed out of the engine as they happen

export function createDeckShuffledEvent(player) {
	return {
		"nature": "event",
		"type": "deckShuffled",
		"player": player
	}
}

export function createStartingPlayerSelectedEvent(player) {
	return {
		"nature": "event",
		"type": "startingPlayerSelected",
		"player": player
	}
}

export function createPartnerRevealedEvent(player) {
	return {
		"nature": "event",
		"type": "partnerRevealed",
		"player": player
	}
}

export function createGameStartedEvent() {
	return {
		"nature": "event",
		"type": "gameStarted"
	}
}

export function createTurnStartedEvent() {
	return {
		"nature": "event",
		"type": "turnStarted"
	}
}

export function createPhaseStartedEvent(phase) {
	return {
		"nature": "event",
		"type": "phaseStarted",
		"phase": phase
	}
}

export function createStackCreatedEvent(stack) {
	return {
		"nature": "event",
		"type": "stackCreated",
		"stack": stack
	}
}

export function createStackStartedEvent(stack) {
	return {
		"nature": "event",
		"type": "stackStarted",
		"stack": stack
	}
}

export function createBlockCreatedEvent(block) {
	return {
		"nature": "event",
		"type": "blockCreated",
		"block": block
	}
}

export function createBlockCreationAbortedEvent(block) {
	return {
		"nature": "event",
		"type": "blockCreationAborted",
		"block": block
	}
}

export function createBlockStartedEvent(block) {
	return {
		"nature": "event",
		"type": "blockStarted",
		"block": block
	}
}

export function createActionCancelledEvent(action) {
	return {
		"nature": "event",
		"type": "actionCancelled",
		"action": action
	}
}

export function createPlayerWonEvent(player) {
	return {
		"nature": "event",
		"type": "playerWon",
		"player": player
	}
}

export function createGameDrawnEvent() {
	return {
		"nature": "event",
		"type": "gameDrawn"
	}
}

export function createDamageDealtEvent(player, amount) {
	return {
		"nature": "event",
		"type": "damageDealt",
		"player": player,
		"amount": amount
	}
}

export function createLifeChangedEvent(player) {
	return {
		"nature": "event",
		"type": "lifeChanged",
		"player": player
	}
}

export function createManaChangedEvent(player) {
	return {
		"nature": "event",
		"type": "manaChanged",
		"player": player
	}
}

export function createCardsDrawnEvent(player, cards) {
	return {
		"nature": "event",
		"type": "cardsDrawn",
		"player": player,
		"cards": cards
	}
}

export function createCardPlacedEvent(player, card, toZone, toIndex) {
	return {
		"nature": "event",
		"type": "cardPlaced",
		"player": player,
		"card": card,
		"toZone": toZone,
		"toIndex": toIndex
	}
}

export function createCardSummonedEvent(player, card, toZone, toIndex) {
	return {
		"nature": "event",
		"type": "cardSummoned",
		"player": player,
		"card": card,
		"toZone": toZone,
		"toIndex": toIndex
	}
}

export function createCardCastEvent(player, card, toZone, toIndex) {
	return {
		"nature": "event",
		"type": "cardCast",
		"player": player,
		"card": card,
		"toZone": toZone,
		"toIndex": toIndex
	}
}

export function createCardDeployedEvent(player, card, toZone, toIndex) {
	return {
		"nature": "event",
		"type": "cardDeployed",
		"player": player,
		"card": card,
		"toZone": toZone,
		"toIndex": toIndex
	}
}

export function createCardMovedEvent(player, card, toZone, toIndex) {
	return {
		"nature": "event",
		"type": "cardMoved",
		"player": player,
		"card": card,
		"toZone": toZone,
		"toIndex": toIndex
	}
}

export function createUndoCardsMovedEvent(movedCards) {
	return {
		"nature": "event",
		"type": "undoCardsMoved",
		"movedCards": movedCards
	}
}

export function createCardsSwappedEvent(player, cardA, cardB, equipmentsTransferred) {
	return {
		"nature": "event",
		"type": "cardsSwapped",
		"player": player,
		"cardA": cardA,
		"cardB": cardB,
		"equipmentsTransferred": equipmentsTransferred
	}
}

export function createUndoCardsSwappedEvent(cardA, cardB) {
	return {
		"nature": "event",
		"type": "undoCardsMoved",
		"cardA": cardA,
		"cardB": cardB
	}
}

export function createAttackDeclarationEstablishedEvent(player, target, attackers) {
	return {
		"nature": "event",
		"type": "attackDeclarationEstablished",
		"player": player,
		"target": target,
		"attackers": attackers
	}
}

export function createCardsAttackedEvent(attackers, target) {
	return {
		"nature": "event",
		"type": "cardsAttacked",
		"attackers": attackers,
		"target": target
	}
}

export function createCardDiscardedEvent(card, toZone) {
	return {
		"nature": "event",
		"type": "cardDiscarded",
		"card": card,
		"toZone": toZone
	}
}

export function createCardDestroyedEvent(card, toZone) {
	return {
		"nature": "event",
		"type": "cardDestroyed",
		"card": card,
		"toZone": toZone
	}
}

export function createCardExiledEvent(card, toZone) {
	return {
		"nature": "event",
		"type": "cardExiled",
		"card": card,
		"toZone": toZone
	}
}

export function createValueChangedEvent(object, valueName, isBaseValue) {
	return {
		"nature": "event",
		"type": "valueChanged",
		"object": object,
		"valueName": valueName,
		"isBaseValue": isBaseValue
	}
}

export function createCardEquippedEvent(equipment, target) {
	return {
		"nature": "event",
		"type": "cardEquipped",
		"equipment": equipment,
		"target": target
	}
}

export function createCardViewedEvent(player, card) {
	return {
		"nature": "event",
		"type": "cardViewed",
		"player": player,
		"card": card
	}
}

export function createCardRevealedEvent(player, card) {
	return {
		"nature": "event",
		"type": "cardRevealed",
		"player": player,
		"card": card
	}
}

export function createCardsSelectedEvent(player, chosenCards) {
	return {
		"nature": "event",
		"type": "cardsSelected",
		"player": player,
		"chosenCards": chosenCards
	}
}

export function createPlayerSelectedEvent(player, chosenPlayer) {
	return {
		"nature": "event",
		"type": "playerSelected",
		"player": player,
		"chosenPlayer": chosenPlayer
	}
}

export function createTypeSelectedEvent(player, chosenType) {
	return {
		"nature": "event",
		"type": "typeSelected",
		"player": player,
		"chosenType": chosenType
	}
}

export function createDeckSideSelectedEvent(player, chosenSide) {
	return {
		"nature": "event",
		"type": "deckSideSelected",
		"player": player,
		"chosenSide": chosenSide
	}
}

export function createCountersChangedEvent(card, type) {
	return {
		"nature": "event",
		"type": "countersChanged",
		"card": card,
		"counterType": type
	}
}

export function createActionModificationAbilityAppliedEvent(ability) {
	return {
		"nature": "event",
		"type": "actionModificationAbilityApplied",
		"ability": ability
	}
}

export function createCancelAbilityAppliedEvent(ability) {
	return {
		"nature": "event",
		"type": "cancelAbilityApplied",
		"ability": ability
	}
}