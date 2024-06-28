// This file contains timing generator functions and related utility functions

import {Timing, runInterjectedTimings} from "./timings.mjs";
import {createCardsAttackedEvent} from "./events.mjs";
import {FieldZone} from "./zones.mjs";
import {ScriptValue} from "./cdfScriptInterpreter/structs.mjs";
import * as actions from "./actions.mjs";
import * as requests from "./inputRequests.mjs";

export class TimingRunner {
	constructor(generatorFunction, game) {
		this.generatorFunction = generatorFunction;
		this.game = game;
		this.optionTree = null; // this is used to determine which options that a player could pick are actually valid
		this.isCost = false;
		this.timings = [];
	}

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
		const interjected = await (yield* runInterjectedTimings(this.game, isPrediction));
		if (interjected) {
			this.timings.push(interjected);
			while (this.timings.at(-1).followupTiming) {
				this.timings.push(this.timings.at(-1).followupTiming);
			}
		}

		let generator = this.generatorFunction();
		let timing = yield* this.getNextTiming(generator, null);
		while (timing instanceof Timing) {
			if (this.isCost) {
				// if an empty timing is generated as part of a cost
				if (timing.actions.length === 0) {
					return false;
				}
				for (let action of timing.actions) {
					action.costIndex = 0;
				}
			}
			this.timings.push(timing);
			await (yield* timing.run(isPrediction));
			while (this.timings.at(-1).followupTiming) {
				this.timings.push(this.timings.at(-1).followupTiming);
			}
			if (!timing.successful && this.isCost) {
				return false;
			}
			timing = yield* this.getNextTiming(generator, timing);
		}
		return timing;
	}

	// Returns either the next timing or the final return value of the passed-in generator
	* getNextTiming(timingGenerator, previousTiming) {
		let generatorOutput = timingGenerator.next(previousTiming);
		while (!generatorOutput.done && (generatorOutput.value.length == 0 || !(generatorOutput.value[0] instanceof actions.Action))) {
			generatorOutput = timingGenerator.next(yield generatorOutput.value);
		}
		if (generatorOutput.done) {
			return generatorOutput.value;
		}
		return new Timing(this.game, generatorOutput.value);
	}

	* undo(isPrediction = false) {
		while (this.timings.length > 0) {
			yield* this.timings.pop().undo(isPrediction);
		}
	}
}

export class OptionTreeNode {
	constructor(game, runner, endOfTreeCheck, parent = null, choice = null) {
		this.game = game;
		this._runner = runner;
		this.endOfTreeCheck = endOfTreeCheck;
		this.parent = parent;
		this.choice = choice; // the choice that got us to this node

		// used to generate children
		this.childResponseGenerator = null;
		this.request = null;

		this._childNodes = [];
		this._isValid = null;
	}

	setRunner(newRunner) {
		this._runner = newRunner;
		for (const child of this._childNodes) {
			child.setRunner(newRunner);
		}
	}

	// only call if the game state is at this node's choice
	async isValid() {
		if (this._isValid !== null) return this._isValid;

		// rewinding this tree's runner to play up to this node in our own generator
		for (const _ of this._runner.undo(true)) {}

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

		// go to next user input request
		let events;
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
				this._isValid = false;
				break;
			}
		} while (!events.done && !(events.value[0] instanceof requests.InputRequest));

		// do we still need to determine validity?
		if (this._isValid === null) {
			// if we are at a user input request, generate child nodes
			if (!events.done) {
				this.request = events.value[0];
				this.childResponseGenerator = events.value[0].generateResponses();

				let response = this.childResponseGenerator.next();
				while (!response.done) {
					const child = new OptionTreeNode(this.game, this._runner, this.endOfTreeCheck, this, {type: this.request.type, value: response.value});
					this._childNodes.push(child);
					if (await child.isValid()) {
						this._isValid = true;
						break;
					}
					response = this.childResponseGenerator.next();
				}
			} else {
				// this tree branch is done.
				this._isValid = events.value && this.endOfTreeCheck();
			}
		}

		// undo everything
		for (const _ of this._runner.undo(true)) {}

		// advance the game state to where it was at the start
		if (this.parent) { // if this is the root, we are done and trying to advance would break stuff
			responsesToHere.pop(); // we don't want to enter this node again
			generator = await this.fastForwardGenerator(responsesToHere);
			do {
				events = await generator.next();
			} while (!(events.value[0] instanceof requests.InputRequest));
		}

		return this._isValid;
	}

	// This lazily generates child nodes as they're being iterated over
	// isValid() needs to be called before this.
	*getChildNodes() {
		// list the children we already have
		for (const child of this._childNodes) {
			yield child;
		}

		if (!this.childResponseGenerator) return;

		let response = this.childResponseGenerator.next();
		while (!response.done) {
			const child = new OptionTreeNode(this.game, this._runner, this.endOfTreeCheck, this, {type: this.request.type, value: response.value});
			this._childNodes.push(child);
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

	// Starts a new generator and plays it through with the given player choices, then returns it.
	async fastForwardGenerator(playerChoices) {
		const generator = this._runner.runAndIgnoreOptionTree(true);
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
		return generator;
	}
}

// It follows: all different types of timing generators
// They return true or false, depending on if all the actions within them were successful.
export function* arrayTimingGenerator(actionArrays) {
	for (const actionList of actionArrays) {
		yield actionList;
	}
	return true;
}

export function* combinedTimingGenerator(generators) {
	let successful = true;
	for (const timingGenerator of generators) {
		// any failed timing should make the whole thing count as unsuccessful.
		if (!(yield* timingGenerator)) {
			successful = false;
		}
	}
	return successful;
}

export function* abilityCostTimingGenerator(ability, card, player) {
	let timingGenerator = ability.runCost(card, player);
	let timing;
	let actionList;
	do {
		// not checking for isCancelled here since costs of cancelled abilities can still be paid.
		actionList = timingGenerator.next(timing);
		if (!actionList.done) {
			if (actionList.value.length == 0) {
				return false;
			}
			timing = yield actionList.value;
		}
	} while (!actionList.done && (!(timing instanceof Timing) || timing.successful));
	return true;
}

export function* abilityTimingGenerator(ability, card, player) {
	let timingGenerator = ability.run(card, player);
	let timing;
	let actionList;
	do {
		if (ability.isCancelled) {
			return false;
		}
		actionList = timingGenerator.next(timing);
		if (!actionList.done) {
			if (actionList.value.length === 0) {
				return false;
			}
			timing = yield actionList.value;
		}
	} while (!actionList.done && (!(timing instanceof Timing) || timing.successful));
	return true;
}

export function* standardDrawTimingGenerator(player) {
	const timing = yield [new actions.Draw(player, player.values.current.standardDrawAmount)];
	return timing.successful;
}

export function* equipTimingGenerator(player, abilityGenerator = null) {
	const currentBlock = player.game.currentBlock();
	const timing = yield [new actions.EquipCard(player, currentBlock.card, currentBlock.equipTarget)];
	if (!timing.successful) return false;

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

	const timing = yield [new actions.Discard(
		player,
		spellItem,
		new ScriptValue("dueToReason", [spellItem.values.current.cardTypes.includes("spell")? "wasCast" : "wasDeployed"])
	)];
	return timing.successful;
}

export function* retireTimingGenerator(player, units) {
	let discardTiming = yield units.map(unit => new actions.Discard(
		player,
		unit,
		new ScriptValue("dueToReason", ["retire"])
	));

	let gainedMana = 0;
	for (const action of discardTiming.actions) {
		if (action instanceof actions.Discard) {
			gainedMana += action.card.values.current.level;
		}
	}
	if (gainedMana > 0) {
		yield [new actions.GainMana(player, gainedMana)];
	}
	return true;
}

export function* fightTimingGenerator(attackDeclaration, fight) {
	if (!(yield* attackGenerator(attackDeclaration, fight, fight.values.current.counterattackFirst))) return false;
	if (!(yield* attackGenerator(attackDeclaration, fight, !fight.values.current.counterattackFirst))) return false;
	return true;
}
function* attackGenerator(attackDeclaration, fight, isCounterattack) {
	// determine attackers and attack target
	let target = attackDeclaration.target;
	let attackers = attackDeclaration.attackers;
	if (isCounterattack) {
		if (attackDeclaration.target === null || !attackDeclaration.attackers[0].values.current.canCounterattack) return true;

		// attacker is the original target
		attackers = [attackDeclaration.target];
		// target is the attacker or, in a combined attack, the partner
		if (attackDeclaration.attackers.length === 1) {
			target = attackDeclaration.attackers[0];
		} else {
			for (const unit of attackDeclaration.attackers) {
				if (unit.zone.type === "partner") {
					target = unit;
					break;
				}
			}
		}
	}
	// if this is supposed to be a counterattack, a missing target/attackers is a normal way for this to exit.
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
			new ScriptValue("dueToReason", ["fight"]),
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
				new ScriptValue("dueToReason", ["fight"]),
				new ScriptValue("card", attackers.map(unit => unit.snapshot()))
			));
		}
		yield actionList;
	}
	return true;
}