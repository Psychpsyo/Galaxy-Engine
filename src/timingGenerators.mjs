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
		this.isCost = false;
		this.timings = [];
	}

	async* run(isPrediction = false) {
		const interjected = await (yield* runInterjectedTimings(this.game, isPrediction));
		if (interjected) {
			this.timings.push(interjected);
			while(this.timings[this.timings.length - 1].followupTiming) {
				this.timings.push(this.timings[this.timings.length - 1].followupTiming);
			}
		}

		let generator = this.generatorFunction();
		let timing = yield* this.getNextTiming(generator, null);
		while(timing instanceof Timing) {
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
			while(this.timings[this.timings.length - 1].followupTiming) {
				this.timings.push(this.timings[this.timings.length - 1].followupTiming);
			}
			if (!timing.successful && this.isCost) {
				return false;
			}
			timing = yield* this.getNextTiming(generator, timing);
		}
		return timing;
	}

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

	* undo() {
		for (let i = this.timings.length - 1; i >= 0; i--) {
			yield* this.timings[i].undo();
		}
		this.timings = [];
	}

	// starts a new generator and plays it through with the given player choices, then returns it.
	async fastForward(playerChoices) {
		let generator = this.run();
		let events = await generator.next();
		while (!events.done && (playerChoices.length > 0 || events.value[0].nature !== "request")) {
			if (events.value[0].nature === "request") {
				events = await generator.next(playerChoices.shift());
			} else {
				events = await generator.next();
			}
		}
		return generator;
	}
}

class OptionTreeNode {
	constructor(parent, choice) {
		this.parent = parent;
		this.choice = choice;
		this.childNodes = [];
		this.valid = false;
	}
}

// Generates a tree of all player choices for a TimingRunner, tagged for validity, based on endOfTreeCheck
// Branches in which the runner does not complete sucessfully are also tagged as invalid.
export async function generateOptionTree(runner, endOfTreeCheck, generator = null, lastNode = null, lastChoice = null) {
	if (generator === null) {
		generator = runner.run(true);
	}
	const node = new OptionTreeNode(lastNode, lastChoice);
	let events = await generator.next(lastChoice);
	// go to next user input request
	while (!events.done && events.value[0].nature !== "request") {
		events = await generator.next();
	}
	// if we are at a user input request, generate child nodes
	if (!events.done) {
		let validResponses = requests[events.value[0].type].generateValidResponses(events.value[0]);
		for (const response of validResponses) {
			let child = await generateOptionTree(runner, endOfTreeCheck, generator, node, {type: events.value[0].type, value: response});
			node.childNodes.push(child);
			if (child.valid) {
				node.valid = true;
			}
			// and then we need to advance the branch to this node again.
			let currentNode = node;
			let responses = [];
			while (currentNode.parent) {
				responses.push(currentNode.choice);
				currentNode = currentNode.parent;
			}
			generator = await runner.fastForward(responses.reverse());
		}
	} else {
		// this tree branch is done.
		node.valid = events.value && endOfTreeCheck();
	}
	let undoGenerator = runner.undo();
	while(!undoGenerator.next().done) {}
	return node;
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

export function* equipTimingGenerator(equipChoiceAction, player, abilityGenerator = null) {
	const timing = yield [new actions.EquipCard(player, equipChoiceAction.spellItem, equipChoiceAction.chosenUnit)];
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
		yield [new actions.ChangeMana(player, gainedMana)];
	}
	return true;
}

export function* fightTimingGenerator(attackDeclaration, fight) {
	const attackOrder = [fight.values.current.counterattackFirst, !fight.values.current.counterattackFirst];
	for (const isCounterattack of attackOrder) {
		if (!(yield* attackGenerator(attackDeclaration, fight, isCounterattack))) return false;
	}
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
		totalAttack += unit.values.current.attack;
	}

	// RULES: If the Attack is greater the attacker destroys the target.
	yield [createCardsAttackedEvent(attackers, target)];
	if (totalAttack > target.values.current.defense) {
		let discard = new actions.Discard(
			target.owner,
			target,
			new ScriptValue("dueToReason", ["fight"]),
			new ScriptValue("card", attackers.map(unit => unit.snapshot()))
		);

		const actionList = [new actions.Destroy(discard), discard];
		const player = target.currentOwner();
		if (target.zone.type === "partner" && fight.values.current.dealDamageTo.includes(player)) {
			let playerDamage = totalAttack - target.values.current.defense;
			if (fight.values.current.lifeDamageOverrides.get(player) !== undefined) {
				playerDamage = fight.values.current.lifeDamageOverrides.get(player);
			}
			actionList.push(new actions.DealDamage(
				player,
				playerDamage
			));
		}
		yield actionList;
	}
	return true;
}