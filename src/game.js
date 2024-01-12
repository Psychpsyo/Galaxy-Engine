// This module exports the Game class which holds all data relevant to a single Cross Universe game.

import {Player} from "./player.js";
import {Turn} from "./turns.js";
import {CURandom} from "./random.js";
import {createDeckShuffledEvent, createStartingPlayerSelectedEvent, createCardsDrawnEvent, createPartnerRevealedEvent, createTurnStartedEvent} from "./events.js";
import * as phases from "./phases.js";
import * as requests from "./inputRequests.js";

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

export const novelTypes = [
	"Ninja",
	"NinjaTool",
	"Ninjutsu",
	"Song"
];
export const novelCounters = [];

export class Game {
	constructor() {
		this.players = [];
		this.players.push(new Player(this));
		this.players.push(new Player(this));

		this.turns = [];
		this.endOfUpcomingTurnTimings = [[], []];
		this.currentAttackDeclaration = null;
		this.nextTimingIndex = 1;

		this.rng = new CURandom(); // the random number source for this game
		this.config = {
			allTypes: baseTypes, // all types that the game is aware of. This may be extended by custom types to allow for custom cards.
			allCounters: baseCounters, // all counters that the game is aware of. This may be extended by custom counters to allow for custom cards.
			startingPlayerChooses: false, // whether or not the randomly selected starting player gets to choose the actual starting player
			validateCardAmounts: true, // whether or not deck card counts should be validated
			lowerDeckLimit: 30, // the minimum number of cards a deck needs
			upperDeckLimit: 50, // the maximum number of cards a deck can have
			startingHandSize: 5 // how many hand cards each player draws at the beginning of the game
		}

		this.replay = {
			config: this.config,
			players: [{deckList: [], partnerIndex: -1}, {deckList: [], partnerIndex: -1}],
			inputLog: [],
			rngLog: []
		}
		this.isReplaying = false;
		this.replayPosition = 0;
		this.replayRngPosition = 0;

		// These keep track of the current numerical IDs assigned to cards over the course of the game.
		// These IDs are used for equality checking since a card, as soon as it moves to a new zone,
		// is considered to be a different card even though it is still the same Card object.
		this.lastGlobalCardId = 0;
		this.currentCards = new Map();
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

		let deckShuffledEvents = [];
		await currentPlayer.deckZone.shuffle();
		await currentPlayer.next().deckZone.shuffle();
		deckShuffledEvents.push(createDeckShuffledEvent(currentPlayer));
		deckShuffledEvents.push(createDeckShuffledEvent(currentPlayer.next()));
		yield deckShuffledEvents;

		// RULES: Randomly decide the first player and the second player.
		// not rules: starting player may be manually chosen.
		if (this.config.startingPlayerChooses) {
			let selectionRequest = new requests.choosePlayer.create(currentPlayer, "chooseStartingPlayer");
			let response = yield [selectionRequest];
			if (response.type != "choosePlayer") {
				throw new Error("Incorrect response type supplied during player selection. (expected \"choosePlayer\", got \"" + response.type + "\" instead)");
			}
			currentPlayer = requests.choosePlayer.validate(response.value, selectionRequest);
		}
		yield [createStartingPlayerSelectedEvent(currentPlayer)];

		// RULES: Draw 5 cards from your deck to your hand.
		let drawHandEvents = [];
		for (let player of this.players) {
			let drawnCards = [];
			for (let i = 0; i < this.config.startingHandSize && player.deckZone.cards.length > 0; i++) {
				let card = player.deckZone.cards[player.deckZone.cards.length - 1];
				drawnCards.push(card.snapshot());
				player.handZone.add(card, player.handZone.cards.length);
				drawnCards[drawnCards.length - 1].globalId = card.globalId;
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
			this.turns.push(new Turn(currentPlayer, this.endOfUpcomingTurnTimings.shift()));
			this.endOfUpcomingTurnTimings.push([]);
			yield [createTurnStartedEvent()];

			const turnGenerator = this.currentTurn().run();
			let generatorOutput = await turnGenerator.next();
			while (!generatorOutput.done) {
				let playerInput;
				const actionList = generatorOutput.value;
				if (actionList.length === 0) {
					return;
				}
				if (actionList[0].nature === "event") {
					playerInput = yield actionList;
				} else if (this.isReplaying && this.replay.inputLog.length > this.replayPosition) { // we're currently stepping through an unfinished replay
					playerInput = this.replay.inputLog[this.replayPosition++];
				} else { // a player actually needs to make a choice
					if (actionList[0].player.aiSystem === null) {
						playerInput = yield actionList;
					} else {
						playerInput = await actionList[0].player.aiSystem.selectMove(actionList);
					}
					this.replay.inputLog.push(playerInput);
					this.replayPosition++;
				}
				generatorOutput = await turnGenerator.next(playerInput);
			}

			for (const card of this.getFieldCards(currentPlayer).concat(this.getFieldCards(currentPlayer.next()))) {
				if (card) {
					card.endOfTurnReset();
				}
			}
			currentPlayer = currentPlayer.next();
		}
	}

	setReplay(replay) {
		this.replay = replay;
		this.config = replay.config;
		this.isReplaying = true;
		this.replayPosition = 0;
		this.replayRngPosition = 0;
		for (const player of this.players) {
			player.setDeck(replay.players[player.index].deckList);
			player.setPartner(replay.players[player.index].partnerIndex);
		}
	}

	async randomInts(ranges) {
		if (this.isReplaying) {
			return this.replay.rngLog[this.replayRngPosition++];
		}
		let results = await this.rng.nextInts(ranges);
		this.replay.rngLog.push([...results]);
		this.replayRngPosition++;
		return results;
	}
	async randomInt(range) {
		if (this.isReplaying) {
			return this.replay.rngLog[this.replayRngPosition++];
		}
		let result = await this.rng.nextInt(range);
		this.replay.rngLog.push(result);
		this.replayRngPosition++;
		return result;
	}
	async randomPlayer() {
		if (this.isReplaying) {
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

	getPhases() {
		return this.turns.map(turn => turn.phases).flat();
	}
	getStacks() {
		return this.turns.map(turn => turn.getStacks()).flat();
	}
	getBlocks() {
		return this.turns.map(turn => turn.getBlocks()).flat();
	}
	getTimings() {
		return this.turns.map(turn => turn.getTimings()).flat();
	}

	currentTurn() {
		return this.turns[this.turns.length - 1];
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

	getFieldCards(player) {
		return player.partnerZone.cards.concat(player.unitZone.cards.concat(player.spellItemZone.cards)).filter(card => card != null);
	}
}

export class AttackDeclaration {
	constructor(game, attackers, target) {
		this.game = game;
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

	removeAttacker(card) {
		let attackerIndex = this.attackers.indexOf(card);
		if (attackerIndex != -1) {
			this.attackers.splice(attackerIndex, 1);
			card.isAttacking = false;
			card.attackCount++;
			card.canAttackAgain = false;
		}
	}

	clear() {
		this.game.currentAttackDeclaration = null;
		for (let attacker of this.attackers) {
			attacker.isAttacking = false;
			attacker.attackCount++;
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
		this.game.currentAttackDeclaration = this;
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
			removed.unit.attackCount--;
			removed.unit.canAttackAgain = removed.canAttackAgain;
		}
	}
}