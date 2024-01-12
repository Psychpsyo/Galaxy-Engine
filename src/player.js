// This module exports the Player class which holds all data relevant to one player in a game.

import {Card} from "./card.js";
import {ObjectValues, PlayerValues} from "./objectValues.js";
import * as zones from "./zones.js";
import * as deckErrors from "./deckErrors.js";

export class Player {
	constructor(game) {
		this.game = game;
		this.index = game.players.length;
		this.mana = 0;
		this.life = 1000;
		this.victoryConditions = [];

		this.deckZone = new zones.DeckZone(this);
		this.handZone = new zones.HandZone(this);
		this.unitZone = new zones.FieldZone(this, "unit", 5);
		this.spellItemZone = new zones.FieldZone(this, "spellItem", 4);
		this.partnerZone = new zones.FieldZone(this, "partner", 1);
		this.discardPile = new zones.PileZone(this, "discard");
		this.exileZone = new zones.PileZone(this, "exile");

		this.values = new ObjectValues(new PlayerValues());
		this.cdfScriptType = "player";

		this.aiSystem = null;
	}

	setDeck(cdfList) {
		if (cdfList.length < this.game.config.lowerDeckLimit) {
			throw new deckErrors.DeckSizeError("Deck has not enough cards!", false);
		}
		if (cdfList.length > this.game.config.upperDeckLimit) {
			throw new deckErrors.DeckSizeError("Deck has too many cards!", true);
		}
		let cardList = [];
		let cardAmounts = {}
		let exampleCards = {}
		for (const cdf of cdfList) {
			let card = new Card(this, cdf);
			card.hiddenFor = [...this.game.players];
			if (card.isToken) {
				throw new deckErrors.DeckTokenError(card.cardId);
			}
			cardList.push(card);
			if (!(card.cardId in exampleCards)) {
				exampleCards[card.cardId] = card;
				cardAmounts[card.cardId] = 1;
			} else {
				cardAmounts[card.cardId]++;
			}
		}
		if (this.game.config.validateCardAmounts) {
			for (const cardId of Object.keys(exampleCards)) {
				if (exampleCards[cardId].deckLimit < cardAmounts[cardId]) {
					throw new deckErrors.CardAmountError(cardId);
				}
			}
		}

		// valid deck was loaded
		this.game.replay.players[this.index].deckList = cdfList;
		for (const card of cardList) {
			this.deckZone.add(card, this.deckZone.cards.length);
		}
	}

	setPartner(partnerPosInDeck) {
		this.game.replay.players[this.index].partnerIndex = partnerPosInDeck;
		let partner = this.deckZone.cards[partnerPosInDeck];
		this.partnerZone.add(partner, 0);
		partner.hiddenFor = [...this.game.players];
	}

	// returns all cards that aren't currently in deck. (cards that could have available abilities on them.)
	getActiveCards() {
		let cards = [this.partnerZone.cards[0]];
		for (let card of this.unitZone.cards) {
			if (card) {
				cards.push(card);
			}
		}
		for (let card of this.spellItemZone.cards) {
			if (card) {
				cards.push(card);
			}
		}
		for (let card of this.handZone.cards) {
			if (card) {
				cards.push(card);
			}
		}
		for (let card of this.discardPile.cards) {
			cards.push(card);
		}
		for (let card of this.exileZone.cards) {
			cards.push(card);
		}
		return cards;
	}

	getAllCards() {
		let cards = this.getActiveCards();
		for (let card of this.deckZone.cards) {
			cards.push(card);
		}
		return cards;
	}

	next() {
		return this.game.players[(this.index + 1) % this.game.players.length];
	}
}