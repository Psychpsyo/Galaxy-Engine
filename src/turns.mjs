import {ManaSupplyPhase, DrawPhase, MainPhase, BattlePhase, EndPhase} from "./phases.mjs";
import {createPhaseStartedEvent} from "./events.mjs";
import {EnterBattlePhase} from "./inputRequests.mjs";

export class Turn {
	constructor(player, actionLists) {
		this.game = player.game;
		this.player = player;
		this.phases = [];
		this.index = this.game.turns.length;

		this.hasStandardDrawn = false;
		this.hasStandardSummoned = false;
		this.hasRetired = false;

		// lists of lists of actions to happen at end of turn and start of phases
		this.actionLists = actionLists;
	}

	async* run() {
		yield* this.runPhase(new ManaSupplyPhase(this));

		yield* this.runPhase(new DrawPhase(this));

		yield* this.runPhase(new MainPhase(this));

		if (this.index > 0 && this.player.values.current.canEnterBattlePhase) {
			const request = new EnterBattlePhase(this.player);
			const response = yield [request];
			if (await request.extractResponseValue(response)) {
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
	getSteps() {
		return this.phases.map(phase => phase.getSteps()).flat();
	}
	getActions() {
		return this.phases.map(phase => phase.getActions()).flat();
	}

	currentPhase() {
		return this.phases.at(-1);
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