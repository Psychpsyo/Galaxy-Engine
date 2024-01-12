// This file contains the error classes that may be thrown while verifying a deck's legality

export class InvalidDeckError extends Error {
	constructor(message) {
		super(message);
		this.name = "InvalidDeckError";
	}
}
export class DeckSizeError extends InvalidDeckError {
	constructor(message, tooMany) {
		super(message);
		this.name = "DeckSizeError";
		this.tooMany = tooMany;
	}
}
export class CardAmountError extends InvalidDeckError {
	constructor(cardId) {
		super("Too many copies of " + cardId);
		this.name = "DeckCardAmountError";
		this.cardId = cardId;
	}
}
export class DeckTokenError extends InvalidDeckError {
	constructor(cardId) {
		super("Deck includes token " + cardId);
		this.name = "DeckTokenError";
		this.cardId = cardId;
	}
}