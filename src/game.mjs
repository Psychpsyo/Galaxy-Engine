// This module exports the Game class which holds all data relevant to a single Cross Universe game.

import {Player} from "./player.mjs";
import {Turn} from "./turns.mjs";
import {CURandom} from "./random.mjs";
import {ObjectValues, GameValues} from "./objectValues.mjs";
import {createDeckShuffledEvent, createStartingPlayerSelectedEvent, createCardsDrawnEvent, createPartnerRevealedEvent, createTurnStartedEvent, createPlayerWonEvent, createGameDrawnEvent} from "./events.mjs";
import * as phases from "./phases.mjs";
import * as requests from "./inputRequests.mjs";

export const baseTypes = [
	"Angel",
	"Armor",
	"Beast",
	"Bird",
	"Book",
	"Boundary",
	"Bug",
	"Chain",
	"Curse",
	"Dark",
	"Demon",
	"Dragon",
	"Earth",
	"Electric",
	"Figure",
	"Fire",
	"Fish",
	"Ghost",
	"Gravity",
	"Ice",
	"Illusion",
	"Katana",
	"Landmine",
	"Light",
	"Machine",
	"Mage",
	"Medicine",
	"Myth",
	"Plant",
	"Psychic",
	"Rock",
	"Samurai",
	"Shield",
	"Spirit",
	"Structure",
	"Sword",
	"Warrior",
	"Water",
	"Wind"
];
export const baseCounters = [
	"Charge",
	"Chaos",
	"Ember",
	"Emergence",
	"Heaven",
	"Invasion",
	"Protection",
	"Rose",
	"Stinger",
	"Time",
	"Weakness",
	"Wrath"
];
export const baseUnitNames = Array.from(Array(294).keys()).map(i => `U${(i+1).toString().padStart(5, "0")}`);
export const baseSpellNames = Array.from(Array(255).keys()).map(i => `S${(i+1).toString().padStart(5, "0")}`);
export const baseItemNames = Array.from(Array(121).keys()).map(i => `I${(i+1).toString().padStart(5, "0")}`);

export const novelTypes = [
	"Ninja",
	"NinjaTool",
	"Ninjutsu",
	"Song"
];
export const novelCounters = [];

// used to keep track of things that will need to happen at certain points in upcoming turns
class TurnActions {
	constructor() {
		this.end = [];
		this.drawPhase = [];
		this.mainPhase1 = [];
		this.battlePhase = [];
		this.mainPhase2 = [];
		this.endPhase = [];
	}
}

export class Game {
	constructor() {
		this.players = [];
		this.players.push(new Player(this));
		this.players.push(new Player(this));

		this.turns = [];
		this.upcomingTurnActions = [
			new TurnActions(),
			new TurnActions()
		];
		this.currentAttackDeclaration = null;
		this.nextStepIndex = 1;

		this.rng = new CURandom(); // the random number source for this game
		this.config = {
			// These aren't currently needed and should always be optional, so not set here.
			// extraTypes: [],             // extra types that this game is aware of for purposes of custom cards.
			// extraCounters: [],          // extra counters that this game is aware of for purposes of custom cards.

			startingPlayerChooses: false, // whether or not the randomly selected starting player gets to choose the actual starting player
			useOldManaRule: false,        // makes it so that all players gain mana at the start of the first player's turn
			validateCardAmounts: true,    // whether or not deck card counts should be validated
			lowerDeckLimit: 30,           // the minimum number of cards a deck needs
			upperDeckLimit: 50,           // the maximum number of cards a deck can have
			startingHandSize: 5           // how many hand cards each player draws at the beginning of the game
		}
		this.allTypes = baseTypes;
		this.allCounters = baseCounters;
		this.allUnitNames = baseUnitNames;
		this.allSpellNames = baseSpellNames;
		this.allItemNames = baseItemNames;

		this.replay = {
			config: this.config,
			players: [{deckList: [], partnerIndex: -1}, {deckList: [], partnerIndex: -1}],
			inputLog: [],
			rngLog: [],
			extra: {} // This can hold arbitrary extra data to be stored with the replay file.
		}
		this.replayPosition = 0;
		this.replayRngPosition = 0;

		// These keep track of the current numerical IDs assigned to cards over the course of the game.
		// These IDs are used for equality checking since a card, as soon as it moves to a new zone,
		// is considered to be a different card even though it is still the same Card object.
		this.lastGlobalCardId = 0;
		this.currentCards = new Map();
		this.lastGlobalAbilityId = 0;
		this.currentAbilities = new Map();

		// a list of all objects whose values might have changed and need recalculating
		this.pendingValueChangeObjects = [];

		// the game itself is able to be affected by static abilities
		this.values = new ObjectValues(new GameValues());
		this.cdfScriptType = "game";
	}

	// Iterate over this function after setting the decks of both players and putting their partners into the partner zones.
	async* begin() {
		let currentPlayer = await this.randomPlayer();

		// RULES: Both players choose one unit from their decks as their partner. Don’t reveal it to your opponent yet.
		for (const player of this.players) {
			if (!player.partnerZone.cards[0].values.current.cardTypes.includes("unit")) {
				throw new Error("All partner cards must be units!");
			}
		}

		const deckShuffledEvents = [];
		await currentPlayer.deckZone.shuffle();
		await currentPlayer.next().deckZone.shuffle();
		deckShuffledEvents.push(createDeckShuffledEvent(currentPlayer.deckZone));
		deckShuffledEvents.push(createDeckShuffledEvent(currentPlayer.next().deckZone));
		yield deckShuffledEvents;

		// RULES: Randomly decide the first player and the second player.
		// not rules: starting player may be manually chosen.
		if (this.config.startingPlayerChooses) {
			const selectionRequest = new requests.ChoosePlayer(currentPlayer, "chooseStartingPlayer");
			const response = yield [selectionRequest];
			currentPlayer = await selectionRequest.extractResponseValue(response);
		}
		yield [createStartingPlayerSelectedEvent(currentPlayer)];

		// RULES: Draw 5 cards from your deck to your hand.
		let drawHandEvents = [];
		for (let player of this.players) {
			let drawnCards = [];
			for (let i = 0; i < this.config.startingHandSize && player.deckZone.cards.length > 0; i++) {
				let card = player.deckZone.cards.at(-1);
				drawnCards.push(card.snapshot());
				player.handZone.add(card, player.handZone.cards.length);
				drawnCards.at(-1).globalId = card.globalId;
			}
			drawHandEvents.push(createCardsDrawnEvent(player, drawnCards));
		}
		yield drawHandEvents;

		// RULES: Both players reveal their partner...
		let partnerRevealEvents = [];
		for (let player of this.players) {
			player.partnerZone.cards[0].hiddenFor = [];
			partnerRevealEvents.push(createPartnerRevealedEvent(player));
		}
		yield partnerRevealEvents;

		// RULES: ...and continue the game as follows.
		while (true) {
			this.turns.push(new Turn(currentPlayer, this.upcomingTurnActions.shift()));
			this.upcomingTurnActions.push(new TurnActions());
			yield [createTurnStartedEvent()];

			const turnGenerator = this.currentTurn().run();
			let generatorOutput = await turnGenerator.next();
			while (!generatorOutput.done) {
				let playerInput;
				const actionList = generatorOutput.value;
				if (actionList.length === 0) {
					return;
				}
				if (!(actionList[0] instanceof requests.InputRequest)) {
					playerInput = yield actionList;
				} else if (this.replay.inputLog.length > this.replayPosition) { // we're currently stepping through an unfinished replay
					playerInput = this.replay.inputLog[this.replayPosition++];
				} else { // a player actually needs to make a choice
					if (actionList[0].player.aiSystem === null) {
						playerInput = yield actionList;
					} else {
						playerInput = await actionList[0].player.aiSystem.selectMove(actionList, actionList[0].player);
					}
					this.replay.inputLog.push(playerInput);
					this.replayPosition++;
				}
				generatorOutput = await turnGenerator.next(playerInput);
			}

			for (const card of this.getActiveCards()) {
				card.endOfTurnReset();
			}
			currentPlayer = currentPlayer.next();
		}
	}

	// To be called whenever victory conditions need to be checked.
	// In case a player won, this function never finishes and keeps yielding empty array to signal that the game is over.
	* checkGameOver() {
		const gameOverEvents = [];
		for (const player of this.players) {
			if (player.victoryConditions.length > 0) {
				if (player.next().victoryConditions.length > 0) {
					gameOverEvents.push(createGameDrawnEvent());
					break;
				}
				gameOverEvents.push(createPlayerWonEvent(player));
			}
		}
		if (gameOverEvents.length > 0) {
			yield gameOverEvents;
			while (true) {
				yield [];
			}
		}
	}

	registerPendingValueChangeFor(object) {
		if (!this.pendingValueChangeObjects.includes(object)) {
			this.pendingValueChangeObjects.push(object);
		}
	}

	// Loads a replay. The replay doesn't need to be complete.
	setReplay(replay) {
		if (replay.config) {
			if (replay.config.upperDeckLimit === null) {
				replay.config.upperDeckLimit = Infinity;
			}
			this.config = replay.config;
			this.replay.config = replay.config;
			this.allTypes = baseTypes.concat(replay.config.extraTypes ?? []);
			this.allCounters = baseCounters.concat(replay.config.extraCounters ?? []);
		}
		if (replay.players) {
			for (let i = 0; i < replay.players; i++) {
				if (replay.players[i]) this.replay.players[i] = replay.players[i];
			}
		}
		if (replay.inputLog) this.replay.inputLog = replay.inputLog;
		if (replay.rngLog) this.replay.rngLog = replay.rngLog;

		this.replayPosition = 0;
		this.replayRngPosition = 0;
		for (const player of this.players) {
			const replayPlayer = replay.players?.[player.index];
			if (replayPlayer) {
				if (replayPlayer.deckList) {
					player.setDeck(replayPlayer.deckList);
				}
				if (typeof replayPlayer.partnerIndex === "number" && replayPlayer.partnerIndex != -1) {
					player.setPartner(replayPlayer.partnerIndex);
				}
			}
		}
	}

	async randomInts(ranges) {
		if (this.replayRngPosition < this.replay.rngLog.length) {
			return [...this.replay.rngLog[this.replayRngPosition++]];
		}
		let results = await this.rng.nextInts(ranges);
		this.replay.rngLog.push([...results]);
		this.replayRngPosition++;
		return results;
	}
	async randomInt(range) {
		if (this.replayRngPosition < this.replay.rngLog.length) {
			return this.replay.rngLog[this.replayRngPosition++];
		}
		let result = await this.rng.nextInt(range);
		this.replay.rngLog.push(result);
		this.replayRngPosition++;
		return result;
	}
	async randomPlayer() {
		if (this.replayRngPosition < this.replay.rngLog.length) {
			return this.players[this.replay.rngLog[this.replayRngPosition++]];
		}
		let result = await this.rng.nextPlayerIndex(this);
		this.replay.rngLog.push(result);
		this.replayRngPosition++;
		return this.players[result];
	}
	undoRandom() {
		this.replayRngPosition--;
		return this.replay.rngLog.pop();
	}

	// returns all cards that aren't currently in a deck. (cards that could have available abilities on them.)
	getActiveCards() {
		const cards = [];
		for (const player of this.players) {
			cards.push(player.partnerZone.cards[0]);
			cards.push(...player.unitZone.cards.filter(card => card !== null));
			cards.push(...player.spellItemZone.cards.filter(card => card !== null));
			cards.push(...player.handZone.cards);
			cards.push(...player.discardPile.cards);
			cards.push(...player.exileZone.cards);
		}
		return cards;
	}

	getAllCards() {
		const cards = this.getActiveCards();
		for (const player of this.players) {
			cards.push(...player.deckZone.cards);
		}
		return cards;
	}

	getPhases() {
		return this.turns.map(turn => turn.phases).flat();
	}
	getStacks() {
		return this.turns.map(turn => turn.getStacks()).flat();
	}
	getBlocks() {
		return this.turns.map(turn => turn.getBlocks()).flat();
	}
	getSteps() {
		return this.turns.map(turn => turn.getSteps()).flat();
	}

	currentTurn() {
		return this.turns.at(-1);
	}
	currentPhase() {
		return this.currentTurn().currentPhase();
	}
	currentStack() {
		let currentPhase = this.currentPhase();
		return !(currentPhase instanceof phases.StackPhase)? null : currentPhase.currentStack();
	}
	currentBlock() {
		return this.currentStack()?.currentBlock() ?? null;
	}
}

export class AttackDeclaration {
	constructor(creator, attackers, target) {
		this.creator = creator;
		this.attackers = attackers;
		this.target = target;
		this.isCombined = attackers.length > 1;
		this.isCancelled = false;
		this.invalidAttackerRemoveUndoStack = [];

		for (let attacker of attackers) {
			attacker.isAttacking = true;
		}
		target.isAttackTarget = true;
	}

	get mainCard() {
		switch (this.attackers.length) {
			case 0: {
				return null;
			}
			case 1: {
				return this.attackers[0];
			}
			default: {
				return this.attackers.find(unit => unit.zone.type == "partner") ?? null;
			}
		}
	}

	// An attack is only valid if it has at least one attacker, an attack target and is not cancelled.
	isValid() {
		if (this.isCancelled) return false;
		if (this.target === null) return false;
		if (this.attackers.length === 0) return false;
		return true;
	}

	removeAttacker(card) {
		let attackerIndex = this.attackers.indexOf(card);
		if (attackerIndex != -1) {
			this.attackers.splice(attackerIndex, 1);
			card.isAttacking = false;
			card.attacksMadeThisTurn++;
			card.canAttackAgain = false;
		}
	}

	clear() {
		this.creator.game.currentAttackDeclaration = null;
		for (let attacker of this.attackers) {
			attacker.isAttacking = false;
			attacker.attacksMadeThisTurn++;
			attacker.canAttackAgain = false;
		}
		if (this.target) {
			this.target.isAttackTarget = false;
		}
	}

	undoClear() {
		if (this.target) {
			this.target.isAttackTarget = true;
		}
		for (let attacker of this.attackers) {
			attacker.isAttacking = true;
		}
		this.creator.game.currentAttackDeclaration = this;
	}

	removeCard(card) {
		if (card === this.target) {
			this.target = null;
			card.isAttackTarget = false;
		}
		this.removeAttacker(card);
	}

	removeInvalidAttackers() {
		let removed = [];
		for (let i = this.attackers.length - 1; i >= 0; i--) {
			if (!this.attackers[i].canAttack()) {
				removed.push({unit: this.attackers[i], canAttackAgain: this.attackers[i].canAttackAgain});
				this.removeAttacker(this.attackers[i]);
			}
		}
		if (this.isCombined) {
			let partner = this.attackers.find(unit => unit.zone.type == "partner");
			for (let i = this.attackers.length - 1; i >= 0; i--) {
				if (!partner || !partner.sharesTypeWith(this.attackers[i])) {
					removed.push({unit: this.attackers[i], canAttackAgain: this.attackers[i].canAttackAgain});
					this.removeAttacker(this.attackers[i]);
				}
			}
		}
		this.invalidAttackerRemoveUndoStack.push(removed);
	}

	undoRemoveInvalidAttackers() {
		for (const removed of invalidAttackerRemoveUndoStack.pop()) {
			this.attackers.push(removed.unit);
			removed.unit.isAttacking = true;
			removed.unit.attacksMadeThisTurn--;
			removed.unit.canAttackAgain = removed.canAttackAgain;
		}
	}
}