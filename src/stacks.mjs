import * as abilities from "./abilities.mjs";
import * as blocks from "./blocks.mjs";
import {createBlockCreatedEvent, createBlockCreationAbortedEvent, createStackStartedEvent, createBlockStartedEvent} from "./events.mjs";
import {runInterjectedSteps} from "./steps.mjs";

export class Stack {
	constructor(phase, index) {
		this.phase = phase;
		this.index = index;
		this.blocks = [];
		this.executingBlock = null;
		this.passed = false;
		this.processed = false;
	}

	async* run() {
		// check non-after based trigger ability triggers (these go during phases or "[when units are] going to attack")
		for (const card of this.phase.turn.game.getActiveCards()) {
			for (let ability of card.values.current.abilities) {
				if (ability instanceof abilities.TriggerAbility) {
					ability.checkDuring(card.currentOwner());
				}
			}
		}
		while (true) {
			const inputRequests = await this.phase.getBlockOptions(this);
			const response = yield [...inputRequests]; // cloning the array in case the calling code modifies it

			const request = inputRequests.find(request => request.type === response.type);
			const responseValue = await request.extractResponseValue(response);

			let nextBlock;
			switch (response.type) {
				case "pass": {
					if (this.passed) {
						yield [createStackStartedEvent(this)];
						yield* this.executeBlocks();
						return;
					}
					this.passed = true;
					break;
				}
				case "doStandardDraw": {
					nextBlock = new blocks.StandardDraw(this, this.getNextPlayer());
					break;
				}
				case "doStandardSummon": {
					nextBlock = new blocks.StandardSummon(this, this.getNextPlayer(), responseValue);
					break;
				}
				case "deployItem": {
					nextBlock = new blocks.DeployItem(
						this,
						this.getNextPlayer(),
						responseValue,
						request._costOptionTrees[request.eligibleItems.indexOf(responseValue)]
					);
					break;
				}
				case "castSpell": {
					nextBlock = new blocks.CastSpell(
						this,
						this.getNextPlayer(),
						responseValue,
						request._costOptionTrees[request.eligibleSpells.indexOf(responseValue)]
					);
					break;
				}
				case "doAttackDeclaration": {
					nextBlock = new blocks.AttackDeclaration(this, this.getNextPlayer(), responseValue);
					break;
				}
				case "doFight": {
					nextBlock = new blocks.Fight(this, this.getNextPlayer());
					break;
				}
				case "doRetire": {
					nextBlock = new blocks.Retire(this, this.getNextPlayer(), responseValue);
					break;
				}
				case "activateOptionalAbility":
				case "activateFastAbility":
				case "activateTriggerAbility": {
					nextBlock = new blocks.AbilityActivation(this, this.getNextPlayer(), responseValue.current());
					break;
				}
			}
			if (response.type != "pass") {
				this.blocks.push(nextBlock);
				this.executingBlock = nextBlock;
				if (await (yield* nextBlock.runCost())) {
					this.executingBlock = null;
					this.passed = false;
					yield [createBlockCreatedEvent(nextBlock)];
				} else {
					this.executingBlock = null;
					this.blocks.pop();
					yield [createBlockCreationAbortedEvent(nextBlock)];
				}
			}
		}
	}

	currentBlock() {
		return this.executingBlock;
	}
	getSteps() {
		let costSteps = this.blocks.map(block => block.getCostSteps()).flat();
		let executionSteps = this.blocks.toReversed().map(block => block.getExecutionSteps()).flat();
		return costSteps.concat(executionSteps);
	}
	getActions() {
		let costActions = this.blocks.map(block => block.getCostActions()).flat();
		let executionActions = this.blocks.toReversed().map(block => block.getExecutionActions()).flat();
		return costActions.concat(executionActions);
	}

	async* executeBlocks() {
		for (let i = this.blocks.length - 1; i >= 0; i--) {
			this.executingBlock = this.blocks[i];
			yield [createBlockStartedEvent(this.blocks[i])];
			yield* this.blocks[i].run();
			this.executingBlock = null;
			this.blocks[i].followupStep = await (yield* runInterjectedSteps(this.phase.turn.game, false));
		}
		this.processed = true;
	}

	async* undoCreateBlock() {
		yield* this.blocks.pop().undoCost();
	}

	async* undoExecuteBlocks() {
		for (let block of this.blocks) {
			yield* block.undoExecution();
		}
		this.processed = false;
	}

	async* undo() {
		if (this.processed) {
			yield* this.undoExecuteBlocks();
		}
		while (this.blocks.length > 0) {
			yield* this.undoCreateBlock();
		}
	}

	getNextPlayer() {
		let player = this.phase.turn.player;
		if (this.blocks.length > 0) {
			player = this.blocks.at(-1).player.next();
		}
		return this.passed? player.next() : player;
	}

	canDoNormalActions() {
		return this.blocks.length == 0 && this.index == 1 && this.getNextPlayer() == this.phase.turn.player;
	}
}