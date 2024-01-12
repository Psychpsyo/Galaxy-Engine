import {ManaSupplyPhase, DrawPhase, MainPhase, BattlePhase, EndPhase} from "./phases.js";
import {createPhaseStartedEvent} from "./events.js";
import {enterBattlePhase} from "./inputRequests.js";

export class Turn {
	constructor(player, endOfTurnTimings) {
		this.game = player.game;
		this.player = player;
		this.phases = [];
		this.index = game.turns.length;

		this.hasStandardDrawn = false;
		this.hasStandardSummoned = false;
		this.hasRetired = false;

		this.endOfTurnTimings = endOfTurnTimings;
	}

	async* run() {
		yield* this.runPhase(new ManaSupplyPhase(this));

		yield* this.runPhase(new DrawPhase(this));

		yield* this.runPhase(new MainPhase(this));

		if (this.index > 0 && this.player.values.current.canEnterBattlePhase) {
			let battlePhase = yield [enterBattlePhase.create(this.player)];
			battlePhase.value = enterBattlePhase.validate(battlePhase.value);
			if (battlePhase.value) {
				yield* this.runPhase(new BattlePhase(this));

				yield* this.runPhase(new MainPhase(this));
			}
		}

		yield* this.runPhase(new EndPhase(this));
	}

	getStacks() {
		return this.phases.slice(1).map(phase => phase.stacks).flat();
	}
	getBlocks() {
		return this.phases.slice(1).map(phase => phase.getBlocks()).flat();
	}
	getTimings() {
		return this.phases.map(phase => phase.getTimings()).flat();
	}
	getActions() {
		return this.phases.map(phase => phase.getActions()).flat();
	}

	currentPhase() {
		return this.phases[this.phases.length - 1];
	}
	currentStack() {
		return this.currentPhase().currentStack();
	}

	async* runPhase(phase) {
		this.phases.push(phase);
		yield [createPhaseStartedEvent(phase)];
		yield* phase.run();
	}
}