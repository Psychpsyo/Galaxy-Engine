// This file contains step generator functions and related utility classes

import {Step, runInterjectedSteps} from "./steps.mjs";
import {createCardsAttackedEvent} from "./events.mjs";
import {FieldZone} from "./zones.mjs";
import {ScriptValue} from "./cdfScriptInterpreter/structs.mjs";
import {StepRunnerInsert} from "./cdfScriptInterpreter/stepRunnerInserts.mjs";
import * as actions from "./actions.mjs";
import * as requests from "./inputRequests.mjs";

export class StepRunner {
	#history = []; // contains both steps and inserts that were run
	constructor(generatorFunction, game) {
		this.generatorFunction = generatorFunction;
		this.game = game;
		this.optionTree = null; // this is used to determine which options that a player could pick are actually valid
		this.isCost = false;
	}

	// wrapper around runAndIgnoreOptionTree() that walks the option tree as we progress through the generator
	// (this one does not ignore the option tree)
	async* run(isPrediction = false) {
		const runGenerator = this.runAndIgnoreOptionTree(isPrediction);
		let events = await runGenerator.next();
		let currentOptionTreeNode = this.optionTree;
		while (!events.done) {
			const atInputRequest = events.value[0] instanceof requests.InputRequest;
			if (atInputRequest) {
				// Set the option tree node on all outgoing input requests so that they adhere to it.
				if (currentOptionTreeNode) {
					if (currentOptionTreeNode.request === null) {
						currentOptionTreeNode = null;
					} else {
						for (const request of events.value) {
							request.optionTreeNode = currentOptionTreeNode;
						}
					}
				}
			}
			const response = yield events.value;
			if (atInputRequest && currentOptionTreeNode) {
				// Walk the tree as the player makes choices.
				currentOptionTreeNode = currentOptionTreeNode.getChildForResponse(response);
			}
			events = await runGenerator.next(response);
		}
		return events.value;
	}

	async* runAndIgnoreOptionTree(isPrediction = false) {
		const interjected = await (yield* runInterjectedSteps(this.game, isPrediction));
		if (interjected) {
			this.#history.push(interjected);
			while (this.#history.at(-1).followupStep) {
				this.#history.push(this.#history.at(-1).followupStep);
			}
		}

		let generator = this.generatorFunction();
		let step = await (yield* this.getNextStep(generator, null, isPrediction));
		while (step instanceof Step) {
			if (this.isCost) {
				// if an empty step is generated as part of a cost
				if (step.actions.length === 0) {
					return false;
				}
				for (let action of step.actions) {
					action.costIndex = 0;
				}
			}
			this.#history.push(step);
			yield* step.run(isPrediction);
			while (this.#history.at(-1).followupStep) {
				this.#history.push(this.#history.at(-1).followupStep);
			}
			if (!step.successful && this.isCost) {
				return false;
			}
			step = await (yield* this.getNextStep(generator, step, isPrediction));
		}
		// step should be a boolean by now
		return step;
	}

	// Returns either the next step or the final return value of the passed-in generator
	async* getNextStep(stepGenerator, previousStep, isPrediction = false) {
		let generatorOutput = stepGenerator.next(previousStep);
		while (!generatorOutput.done) {
			if (generatorOutput.value instanceof StepRunnerInsert) {
				yield* generatorOutput.value.run(isPrediction);
				this.#history.push(generatorOutput.value);
				generatorOutput = stepGenerator.next();
				continue;
			}
			if (generatorOutput.value.length > 0 && generatorOutput.value[0] instanceof actions.Action) {
				break;
			}
			generatorOutput = stepGenerator.next(yield generatorOutput.value);
		}
		if (generatorOutput.done) {
			return generatorOutput.value;
		}
		return new Step(this.game, generatorOutput.value);
	}

	* undo(isPrediction = false) {
		while (this.#history.length > 0) {
			yield* this.#history.pop().undo(isPrediction);
		}
	}

	getSteps() {
		return this.#history.map(histElem => {
			if (histElem instanceof Step) return histElem;
			// else it's an insert
			return histElem.getSteps();
		}).flat();
	}
}

export class OptionTreeNode {
	#runner;
	#childNodes = [];
	#isValid = null;
	constructor(game, runner, endOfTreeCheck, parent = null, choice = null) {
		this.game = game;
		this.#runner = runner;
		this.endOfTreeCheck = endOfTreeCheck;
		this.parent = parent;
		this.choice = choice; // the choice that got us to this node

		// used to generate children
		this.childResponseGenerator = null;
		this.request = null;
	}

	setRunner(newRunner) {
		this.#runner = newRunner;
		for (const child of this.#childNodes) {
			child.setRunner(newRunner);
		}
	}

	// only call if the game state is at this node's choice
	async isValid() {
		if (this.#isValid !== null) return this.#isValid;

		// rewinding this tree's runner to play up to this node in our own generator
		for (const _ of this.#runner.undo(true)) {}

		// gather choices needed to get to this node
		let currentNode = this;
		const responsesToHere = [];
		while (currentNode?.parent) { // parent must exist to insert choice since the root of the tree (which has no parent) was not reached via choice.
			responsesToHere.push(currentNode.choice);
			currentNode = currentNode.parent;
		}
		responsesToHere.reverse();

		// fast forward to this node
		let generator = await this.fastForwardGenerator(responsesToHere); // the generator that walks down the tree
		let events;

		if (generator) {
			// go to next user input request
			do {
				// Check if the game has ended before advancing to the next events so that we can know that the game was ended
				// by the previous set of events and therefore the existance of this following set needs to invalidate the node.
				// (If the game ends as the last thing in the tree, that is valid.)
				let gameEnded = false;
				for (const player of this.game.players) {
					if (player.victoryConditions.length > 0) {
						gameEnded = true;
					}
				}
				events = await generator.next();
				// If we aren't done with events yet but the game ended, this node doesn't
				// represent a valid path and there is no point in calculating its children.
				if (gameEnded && !events.done) {
					this.#isValid = false;
					break;
				}

			} while (!events.done && !(events.value[0] instanceof requests.InputRequest));
		} else { // we are at the end, do not try and go further
			this.#isValid = this.endOfTreeCheck();
		}

		// do we still need to determine validity?
		if (this.#isValid === null) {
			// if we are at a user input request, generate child nodes
			if (!events.done) {
				this.request = events.value[0];
				this.childResponseGenerator = events.value[0].generateResponses();

				let response = this.childResponseGenerator.next();
				while (!response.done) {
					const child = new OptionTreeNode(this.game, this.#runner, this.endOfTreeCheck, this, {type: this.request.type, value: response.value});
					this.#childNodes.push(child);
					if (await child.isValid()) {
						this.#isValid = true;
						break;
					}
					response = this.childResponseGenerator.next();
				}
			} else {
				// this tree branch is done.
				this.#isValid = events.value && this.endOfTreeCheck();
			}
		}

		// undo everything
		for (const _ of this.#runner.undo(true)) {}

		// advance the game state to where it was at the start
		if (this.parent) { // if this is the root, we are done and trying to advance would break stuff
			responsesToHere.pop(); // we don't want to enter this node again
			generator = await this.fastForwardGenerator(responsesToHere);
			do {
				events = await generator.next();
			} while (!(events.value[0] instanceof requests.InputRequest));
		}

		return this.#isValid;
	}

	// This lazily generates child nodes as they're being iterated over
	// isValid() needs to be called before this.
	*getChildNodes() {
		// list the children we already have
		for (const child of this.#childNodes) {
			yield child;
		}

		if (!this.childResponseGenerator) return;

		let response = this.childResponseGenerator.next();
		while (!response.done) {
			const child = new OptionTreeNode(this.game, this.#runner, this.endOfTreeCheck, this, {type: this.request.type, value: response.value});
			this.#childNodes.push(child);
			yield child;
			response = this.childResponseGenerator.next();
		}
	}

	// only call if the game state is at this node's choice
	async isValidChoice(playerResponse) {
		return await this.getChildForResponse(playerResponse)?.isValid() ?? false;
	}

	getChildForResponse(playerResponse) {
		for (const child of this.getChildNodes()) {
			if (this.request.areResponseValuesEquivalent(child.choice.value, playerResponse.value)) {
				return child;
			}
		}
		return null;
	}

	// Starts a new generator and plays it through with the given player choices, then returns it (or null, if it is finished)
	async fastForwardGenerator(playerChoices) {
		const generator = this.#runner.runAndIgnoreOptionTree(true);
		let events = null;
		let currentChoice = 0;
		while (currentChoice < playerChoices.length && (events === null || !events.done)) {
			if (events?.value[0] instanceof requests.InputRequest) {
				events = await generator.next(playerChoices[currentChoice]);
				currentChoice++;
			} else {
				events = await generator.next();
			}
		}
		if (events?.done) return null;
		return generator;
	}
}

// It follows: all different types of step generators
// They return true or false, depending on if all the actions within them were successful.
export function* arrayStepGenerator(actionArrays) {
	for (const actionList of actionArrays) {
		yield actionList;
	}
	return true;
}

export function* combinedStepGenerator(generators) {
	let successful = true;
	for (const stepGenerator of generators) {
		// any failed step should make the whole thing count as unsuccessful.
		if (!(yield* stepGenerator)) {
			successful = false;
		}
	}
	return successful;
}

export function* abilityCostStepGenerator(ability, ctx) {
	let stepGenerator = ability.runCost(ctx);
	let yieldValue;
	let actionList;
	do {
		// not checking for isCancelled here since costs of cancelled abilities can still be paid.
		actionList = stepGenerator.next((yieldValue instanceof Step)? yieldValue : undefined);
		if (!actionList.done) {
			if (actionList.value.length == 0) {
				return false;
			}
			yieldValue = yield actionList.value;
		}
	} while (!actionList.done && (!(yieldValue instanceof Step) || yieldValue.successful));
	return true;
}

export function* abilityStepGenerator(ability, ctx) {
	let stepGenerator = ability.run(ctx);
	let yieldValue;
	let actionList;
	do {
		if (ability.isCancelled) {
			return false;
		}
		actionList = stepGenerator.next((yieldValue instanceof Step)? yieldValue : undefined);
		if (!actionList.done) {
			if (actionList.value.length === 0) {
				return false;
			}
			yieldValue = yield actionList.value;
		}
	} while (!actionList.done && (!(yieldValue instanceof Step) || yieldValue.successful));
	return true;
}

// runs a part of an ability, used mostly for things that need OptionTree limiting during an effect
export function* abilityFractionStepGenerator(astNode, ctx) {
	let stepGenerator = astNode.eval(ctx);
	let yieldValue;
	let actionList;
	do {
		if (ctx.ability.isCancelled) {
			return false;
		}
		actionList = stepGenerator.next((yieldValue instanceof Step)? yieldValue : undefined);
		if (!actionList.done) {
			if (actionList.value.length == 0) {
				return false;
			}
			yieldValue = yield actionList.value;
		}
	} while (!actionList.done && (!(yieldValue instanceof Step) || yieldValue.successful));
	return true;
}

export function* standardDrawStepGenerator(player) {
	const step = yield [new actions.Draw(player, player.values.current.standardDrawAmount, new ScriptValue("dueToReason", ["standardDraw"]))];
	return step.successful;
}

export function* equipStepGenerator(player, abilityGenerator = null) {
	const currentBlock = player.game.currentBlock();
	const step = yield [new actions.EquipCard(player, currentBlock.card, currentBlock.equipTarget)];
	if (!step.successful) return false;

	if (abilityGenerator !== null) {
		return yield* abilityGenerator;
	}
	return true;
}

export function* spellItemDiscardGenerator(player, spellItem) {
	// don't discard things that aren't on the field
	if (!(spellItem.zone instanceof FieldZone)) return true;
	// don't discard continuous spells/items
	if (spellItem.values.current.cardTypes.includes("continuousSpell")) return true;
	if (spellItem.values.current.cardTypes.includes("continuousItem")) return true;
	// don't discard spells/items that equipped successfully
	if (spellItem.equippedTo !== null) return true;

	const step = yield [new actions.Discard(
		player,
		spellItem,
		new ScriptValue("dueToReason", [spellItem.values.current.cardTypes.includes("spell")? "wasCast" : "wasDeployed"])
	)];
	return step.successful;
}

export function* retireStepGenerator(player, units) {
	let discardStep = yield units.map(unit => new actions.Discard(
		player,
		unit,
		new ScriptValue("dueToReason", ["retire"])
	));

	let gainedMana = 0;
	for (const action of discardStep.actions) {
		if (action instanceof actions.Discard && !action.isCancelled) {
			gainedMana += action.card.values.current.level;
		}
	}
	if (gainedMana > 0) {
		yield [new actions.GainMana(player, gainedMana)];
	}
	return true;
}

export function* fightStepGenerator(attackDeclaration, fight) {
	if (!(yield* attackGenerator(attackDeclaration, fight, fight.values.current.counterattackFirst))) return false;
	if (!(yield* attackGenerator(attackDeclaration, fight, !fight.values.current.counterattackFirst))) return false;
	return true;
}
function* attackGenerator(attackDeclaration, fight, isCounterattack) {
	// determine attackers and attack target
	let target = attackDeclaration.target;
	let attackers = attackDeclaration.attackers;
	if (isCounterattack) {
		// if this is supposed to be a counterattack, a missing target(attacker) is a normal way for this to exit.
		if (attackDeclaration.target === null || !attackDeclaration.target.values.current.canCounterattack) return true;

		// swap attacker(s) and target
		attackers = [attackDeclaration.target];
		target = attackDeclaration.mainCard;
	}

	if (target === null || attackers.length === 0) return false;

	// RULES: Compare the attacker’s Attack to the target’s Defense.
	let totalAttack = 0;
	for (const unit of attackers) {
		totalAttack += unit.values[fight.values.current.useBaseValuesFor.includes(unit)? "base" : "current"].attack;
	}
	const defense = target.values[fight.values.current.useBaseValuesFor.includes(target)? "base" : "current"].defense;

	// RULES: If the Attack is greater the attacker destroys the target.
	yield [createCardsAttackedEvent(attackers, target)];
	if (totalAttack > defense) {
		let discard = new actions.Discard(
			target.owner,
			target,
			new ScriptValue("fight", [fight]),
			new ScriptValue("card", attackers.map(unit => unit.snapshot()))
		);

		const actionList = [new actions.Destroy(discard), discard];
		const player = target.currentOwner();
		if (target.zone.type === "partner" && fight.values.current.dealDamageTo.includes(player)) {
			let playerDamage = totalAttack - defense;
			if (fight.values.current.lifeDamageOverrides.get(player) !== undefined) {
				playerDamage = fight.values.current.lifeDamageOverrides.get(player);
			}
			actionList.push(new actions.DealDamage(
				attackDeclaration.creator,
				player,
				playerDamage,
				new ScriptValue("fight", [fight]),
				new ScriptValue("card", attackers.map(unit => unit.snapshot()))
			));
		}
		yield actionList;
	}
	return true;
}