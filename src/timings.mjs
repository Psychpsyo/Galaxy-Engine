
import {createActionPreventedEvent, createValueChangedEvent, createActionModificationAbilityAppliedEvent} from "./events.mjs";
import {ChooseAbilityOrder, ChooseCards, ApplyActionModificationAbility} from "./inputRequests.mjs";
import {Player} from "./player.mjs";
import {ScriptContext, ScriptValue} from "./cdfScriptInterpreter/structs.mjs";
import {BaseCard} from "./card.mjs";
import {recalculateModifiedValuesFor, ActionReplaceModification, ActionModification, ProhibitModification, CompleteUnaffection} from "./valueModifiers.mjs";
import {arrayTimingGenerator} from "./timingGenerators.mjs";
import * as abilities from "./abilities.mjs";
import * as blocks from "./blocks.mjs";
import * as phases from "./phases.mjs";
import * as actions from "./actions.mjs";
import * as zones from "./zones.mjs";
import * as ast from "./cdfScriptInterpreter/astNodes.mjs";

export class UndoActionQueueEntry {
	actions;
	timestep;
	constructor(actions, timestep) {
		this.actions = actions;
		this.timestep = timestep;
	}
}

// Represents a single instance in time where multiple actions take place at once.
export class Timing {
	game;
	index;
	actions;
	costCompletions = [];
	successful = false;
	followupTiming = null;
	// The static action modification abilities that were applied during this timing.
	// This needs to be tracked for those that can only be activated once per game.
	staticAbilitiesApplied = [];
	// A list of undo action queue objects, with an 'actions' and a 'timestep' property.
	// This is necessary for when multiple Actions in this timing queue an undo action, to recombine them into being simultaneous.
	// An example of a card that does this is 'Spacetime Passage'.
	undoActionQueue = [];
	constructor(game, actionList) {
		this.game = game;
		this.actions = actionList;
		for (const action of this.actions) {
			action.timing = this;
		}
	}

	// cancels the given action and any implied actions and returns the actionCancelledEvents for all of them
	#cancelAction(action, alsoRemoved = false) {
		const events = [];
		for (const cancelled of action.setIsCancelled()) {
			events.push(createActionPreventedEvent(cancelled, alsoRemoved));
			if (cancelled.costIndex >= 0) {
				this.costCompletions[cancelled.costIndex] = false;
			}
		}
		return events;
	}

	// returns a list of actionCancelled events and sets impossible actions to cancelled
	async #cancelImpossibleActions() {
		const events = [];
		for (const action of this.actions) {
			if (action.isCancelled) continue;
			if (await action.isImpossible() ||

				this.game.values.modifierStack.some(modifier => {
					for (const modification of modifier.modifications) {
						if (!(modification instanceof ProhibitModification)) continue;

						ast.setImplicit([action], "action");
						if (action.affectedObjects.length > 0) {
							ast.setImplicit(action.affectedObjects, action.affectedObjects[0].cdfScriptType);
						}
						const doesMatch = modification.toProhibit.evalFull(modifier.ctx).next().value.getJsBool();
						if (action.affectedObjects.length > 0) {
							ast.clearImplicit(action.affectedObjects[0].cdfScriptType);
						}
						ast.clearImplicit("action");

						if (doesMatch) return true;
					}
					return false;
				}) ||

				action.affectedObjects.some(object => {
					// CompleteUnaffections only protect against the effects of cards.
					if (action.properties.by?.type !== "card") return false;
					if (!action.properties.dueTo.get().includes("effect")) return false;

					ast.setImplicit(action.properties.by.get(), "card");
					for (const unaffection of object.values.unaffectedBy) {
						if (unaffection instanceof CompleteUnaffection &&
							unaffection.by.evalFull(unaffection.modifier.ctx).next().value.getJsBool(unaffection.modifier.ctx.player)
						) {
							ast.clearImplicit("card");
							return true;
						}
					}
					ast.clearImplicit("card");
					return false;
				})
			) {
				events.push(...this.#cancelAction(action, true));
			}
		}
		// after cancelling them all, also remove them from the timings since they are not supposed to be about to happen.
		// Cancelling is technically not necessary but doesn't really change anything and lets us re-use the code that
		// figures out that destroys and discards are linked in this case and also takes out the right costs.
		for (const event of events) {
			this.actions.splice(this.actions.indexOf(event.action), 1);
		}
		return events;
	}

	// applies static abilities like that on 'Substitution Doll' or 'Norma, of the Sandstorm'
	async* #handleModificationAbilities() {
		// gather abilities
		const applicableAbilities = new Map();
		const targets = new Map(); // cards that modification abilities will apply to
		for (const player of this.game.players) {
			targets.set(player, []);
		}

		for (const modifier of this.game.values.modifierStack) { // where ActionReplaceModifications are kept
			if (!(modifier.modifications[0] instanceof ActionModification)) continue;

			for (const action of this.actions) {
				// can't modify cancelled actions as they are not about to happen
				if (action.isCancelled) continue;

				// for replacement abilities, we need to figure out if the replacement is not already happening.
				if (modifier.modifications[0] instanceof ActionReplaceModification) {
					let replacementsValid = true;
					// TODO: This currently yields requests to the user but should ideally play through all options to figure out if a valid
					//       replacement can be constructed. This does not currently matter on any official cards.
					ast.setImplicit([action], "action");
					for (const output of modifier.modifications[0].replacement.eval(modifier.ctx)) {
						if (output.length === 0) {
							replacementsValid = false;
							break;
						}
						if (output[0] instanceof actions.Action) {
							let replacements = output;
							for (const action of this.actions) {
								for (const replacement of replacements) {
									if (action.isIdenticalTo(replacement)) replacementsValid = false;
								}
							}
							break;
						}
						yield output;
					}
					ast.clearImplicit("action");
					if (!replacementsValid) continue;
				}

				for (const target of action.affectedObjects) {
					if (target.cdfScriptType != "card") continue; // TODO: this should work but ordering can't deal with non-cards yet.
					                                              //       (this is also not needed for any official cards)

					// check if the action matches
					ast.setImplicit([action], "action");
					if (action.affectedObjects.length > 0) {
						ast.setImplicit(action.affectedObjects, target.cdfScriptType);
					}
					const doesMatch = (yield* modifier.modifications[0].toModify.eval(modifier.ctx)).getJsBool();
					if (action.affectedObjects.length > 0) {
						ast.clearImplicit(target.cdfScriptType);
					}
					ast.clearImplicit("action");
					if (!doesMatch) continue;

					// abilities are just dumped in a list here to be sorted later.
					const abilities = applicableAbilities.get(target) ?? [];
					abilities.push(modifier.ctx.ability);
					applicableAbilities.set(target, abilities);
					// also keep track of which targets will need to be affected
					const oldTargets = targets.get(target.currentOwner());
					if (!oldTargets.includes(target)) {
						oldTargets.push(target);
						targets.set(target.currentOwner(), oldTargets);
					}
				}
			}
		}

		// go through all cards in turn player, non-turn player order
		for (const player of [this.game.currentTurn().player, this.game.currentTurn().player.next()]) {
			const remainingCards = targets.get(player);
			while (remainingCards.length > 0) {
				let target;
				if (remainingCards.length > 1) {
					const request = new ChooseCards(player, remainingCards, [1], "nextCardToApplyStaticAbilityTo");
					const response = yield [request];
					target = await request.extractResponseValue(response)[0];
				} else {
					target = remainingCards[0];
				}
				remainingCards.splice(remainingCards.indexOf(target), 1);

				// apply modifications to this card
				for (const ability of await (yield* orderStaticAbilities(target, applicableAbilities.get(target), this.game))) {
					const modifier = ability.getModifier();
					let didApply = false;
					for (let i = 0; i < this.actions.length; i++) {
						// can't modify cancelled actions as they are not about to happen
						if (this.actions[i].isCancelled) continue;

						ast.setImplicit([this.actions[i]], "action");
						ast.setImplicit([target], "card");
						const doesMatch = (yield* modifier.modifications[0].toModify.eval(modifier.ctx)).getJsBool();
						ast.clearImplicit("card");
						ast.clearImplicit("action");
						if (!doesMatch) continue;
						// otherwise, this action can be replaced

						let replacements;
						// gather replacements
						if (modifier.modifications[0] instanceof ActionReplaceModification) {
							ast.setImplicit([this.actions[i]], "action");
							for (const output of modifier.modifications[0].replacement.eval(modifier.ctx)) {
								if (output[0] instanceof actions.Action) {
									replacements = output;
									break;
								}
								yield output;
							}
							ast.clearImplicit("action");

							// process replacements
							let foundInvalidReplacement = false;
							for (const replacement of replacements) {
								replacement.timing = this;

								if (!(await replacement.isFullyPossible())) {
									foundInvalidReplacement = true;
									break;
								}
							}
							if (foundInvalidReplacement) continue;
						}

						// ask player if they want to apply optional modification
						if (!ability.mandatory) {
							const request = new ApplyActionModificationAbility(ability.card.currentOwner(), ability, target);
							const response = yield [request];
							if (!await request.extractResponseValue(response)) continue;
						}

						// apply the modification
						yield [createActionModificationAbilityAppliedEvent(ability)];
						if (modifier.modifications[0] instanceof ActionReplaceModification) {
							actions.replaceActionInList(this.actions, this.actions[i], replacements);
						} else { // cancel ability instead
							yield this.#cancelAction(this.actions[i]);
						}
						ability.successfulApplication();
						this.staticAbilitiesApplied.push({ability: ability, player: ability.card.currentOwner()});
						didApply = true;
						break;
					}

					// remove ability from the remaining ones if it is no longer usable
					if (didApply && !ability.canApply(ability.card, ability.card.currentOwner())) {
						for (let i = remainingCards.length - 1; i >= 0; i--) {
							const abilities = applicableAbilities.get(remainingCards[i]);
							const index = abilities.indexOf(ability);
							if (index === -1) continue;
							abilities.splice(index, 1);
							if (abilities.length === 0) {
								applicableAbilities.delete(remainingCards[i]);
								remainingCards.splice(i, 1);
							} else {
								applicableAbilities.set(remainingCards[i], abilities);
							}
						}
					}
				}
			}
		}
	}

	async isFullyPossible(costIndex) {
		for (const action of this.actions) {
			if (action.costIndex === costIndex && (action.isCancelled || !(await action.isFullyPossible()))) {
				return false;
			}
		}
		return true;
	}

	async* run(isPrediction = false) {
		this.index = this.game.nextTimingIndex;
		this.game.nextTimingIndex++;

		for (const action of this.actions) {
			if (action.costIndex >= this.costCompletions.length) {
				this.costCompletions.push(true);
			}
		}

		// cancel impossible actions
		const cancelEvents = await this.#cancelImpossibleActions();
		if (cancelEvents.length > 0) {
			yield cancelEvents;
		}

		// apply static substitution abilities to the rest
		yield* this.#handleModificationAbilities();

		if (this.costCompletions.length > 0) {
			// empty costs count as successful completion
			// TODO: Figure out and elaborate on why this should be the case (cause I think it's wrong)
			if (this.actions.length === 0 && this.costCompletions.includes(true)) {
				this.successful = true;
				return;
			}
			for (let i = 0; i < this.costCompletions.length; i++) {
				this.costCompletions[i] = this.costCompletions[i] && await this.isFullyPossible(i);
			}
			for (const action of this.actions) {
				if (!this.costCompletions[action.costIndex]) {
					action.isCancelled = true;
				}
			}
		}
		// fully cancelled timings are not successful, they interrupt their block or indicate that paying all costs failed.
		if (this.actions.every(action => action.isCancelled) || this.actions.length === 0) {
			this.game.nextTimingIndex--;
			return;
		}

		// check trigger ability preconditions
		if (!isPrediction) {
			if (this.game.currentPhase() instanceof phases.StackPhase) {
				for (const card of this.game.getAllCards()) {
					for (const ability of card.values.current.abilities) {
						if (ability instanceof abilities.TriggerAbility ||
							ability instanceof abilities.CastAbility) {
							ability.checkTriggerPrecondition(card.currentOwner());
						}
					}
				}
			}
		}

		// run actions and collect events
		let events = [];
		let nextActions = this.actions;
		do {
			for (const action of nextActions) {
				if (action.isCancelled) continue;

				const event = await (yield* action.run(isPrediction));
				if (event) {
					events.push(event);
				}
			}

			// TODO: These need to be checked for legality and substitution just like the original actions
			nextActions = this.getFollowupActions(nextActions);
			for (const action of nextActions) {
				this.actions.push(action);
			}
		} while (nextActions.length > 0);

		if (events.length > 0) {
			yield events;
		}

		if (!isPrediction) {
			// consolidate and queue up any undo actions for things that may need to run out at some point
			const undoActionMap = new Map();
			for (const undoQueueEntry of this.undoActionQueue) {
				const consolidated = undoActionMap.get(undoQueueEntry.timestep) ?? [];
				undoActionMap.set(
					undoQueueEntry.timestep,
					consolidated.concat(undoQueueEntry.actions)
				);
			}
			for (const [timestep, actions] of undoActionMap) {
				timestep.push(arrayTimingGenerator([actions]));
			}
		}

		this.successful = true;
		this.game.currentPhase().lastActionList = this.actions;

		// TODO: The following things do not have proper undo support yet.
		// This *should* only matter when units turn into spells/items so for now it does not matter(?)
		// (That's because in those cases, modifiers on the card are destroyed and wouldn't properly get restored)
		const valueChangeEvents = recalculateObjectValues(this.game, isPrediction);
		if (valueChangeEvents.length > 0) {
			yield valueChangeEvents;
		}
		this.game.currentAttackDeclaration?.removeInvalidAttackers();

		if (!isPrediction) {
			// check win/lose conditions
			yield* this.game.checkGameOver();

			// check trigger ability conditions
			if (this.game.currentPhase() instanceof phases.StackPhase) {
				for (let card of this.game.getAllCards()) {
					for (let ability of card.values.current.abilities) {
						if (ability instanceof abilities.TriggerAbility ||
							ability instanceof abilities.CastAbility) {
							ability.checkTrigger(card.currentOwner());
						}
					}
				}
			}
		}

		this.followupTiming = await (yield* runInterjectedTimings(this.game, isPrediction, this.actions));
	}

	* undo(isPrediction = false) {
		// check if this timing actually ran
		if (!this.successful) {
			return;
		}

		if (!isPrediction) {
			// un-queue all the undo actions that might have been queued up by this
			const poppedFrom = [];
			for (const undoQueueEntry of this.undoActionQueue) {
				if (poppedFrom.includes(undoQueueEntry.timestep)) continue;
				// else
				undoQueueEntry.timestep.pop();
				poppedFrom.push(undoQueueEntry.timestep);
			}
		}

		let events = [];
		for (let i = this.actions.length - 1; i >= 0; i--) {
			const event = this.actions[i].undo(isPrediction);
			if (event) {
				events.push(event);
			}
		}
		const valueChangeEvents = recalculateObjectValues(this.game, isPrediction);
		if (valueChangeEvents.length > 0) {
			yield valueChangeEvents;
		}
		if (events.length > 0) {
			yield events;
		}

		this.game.nextTimingIndex--;
	}

	getFollowupActions(lastActions = []) {
		// cards need to be revealed if added from deck to hand
		let unrevealedCards = [];
		for (const action of lastActions) {
			if (action.isCancelled) continue;
			if (action instanceof actions.Move && action.zone.type === "hand" && action.card.zone.type === "deck") {
				if (unrevealedCards.indexOf(action.card) === -1) {
					unrevealedCards.push(action.card);
				}
			}
		}

		// decks need to be shuffled after cards are added to them.
		const unshuffledDecks = [];
		for (const action of lastActions) {
			if (action.isCancelled) continue;
			// if a card is being MOVEd out of a deck
			if (action instanceof actions.Move &&
				action.card.zone instanceof zones.DeckZone &&
				!(action.zone instanceof zones.DeckZone)
			) {
				unshuffledDecks.push(action.card.zone);
			}
			// if a card is being MOVEd into an arbitrary spot in a deck
			if (action instanceof actions.Move && action.zone instanceof zones.DeckZone && action.targetIndex === null) {
				unshuffledDecks.push(action.zone);
			}
			// if a card is being SWAPped out of a deck
			if (action instanceof actions.Swap && (action.cardA?.zone instanceof zones.DeckZone || action.cardB?.zone instanceof zones.DeckZone)) {
				if (action.cardA.zone instanceof zones.DeckZone) {
					unshuffledDecks.push(action.cardA.zone);
				}
				if (action.cardB.zone instanceof zones.DeckZone) {
					unshuffledDecks.push(action.cardB.zone);
				}
			}
		}

		const allActions = unrevealedCards.map(card => new actions.View(card.currentOwner().next(), card.current()));
		for (const deck of unshuffledDecks) {
			if (!allActions.some(action => action instanceof actions.Shuffle && action.player === deck.player)) {
				allActions.push(new actions.Shuffle(deck.player));
			}
		}
		if (allActions.length > 0) {
			return allActions;
		}

		// Equipments might need to be destroyed
		const invalidEquipments = [];
		for (const equipment of this.game.players.map(player => player.spellItemZone.cards).flat()) {
			if (equipment && (equipment.values.current.cardTypes.includes("equipableItem") || equipment.values.current.cardTypes.includes("enchantSpell")) &&
				(equipment.equippedTo === null || !equipment.equipableTo.evalFull(new ScriptContext(equipment, equipment.currentOwner())).next().value.get(equipment.currentOwner()).includes(equipment.equippedTo))
			) {
				if (!this.actions.some(action => action instanceof actions.Discard && action.card === equipment)) {
					invalidEquipments.push(equipment);
				}
			}
		}
		if (invalidEquipments.length > 0) {
			const discards = invalidEquipments.map(equipment => new actions.Discard(
				equipment.owner,
				equipment,
				new ScriptValue("dueToReason", ["invalidEquipment"]),
				new ScriptValue("card", [])
			));
			discards.push(...discards.map(discard => new actions.Destroy(discard)))
			return discards;
		}
		return [];
	}

	valueOf() {
		return this.index;
	}
}

// This is run after every regular timing and right after blocks start and end.
// It takes care of updating static abilities.
export async function* runInterjectedTimings(game, isPrediction) {
	const timing = await (yield* getTimingForStaticAbilityPhasing(game));
	if (timing) {
		await (yield* timing.run(isPrediction));
	}
	return timing;
}

// iterates over all static abilities and activates/deactivates those that need it.
async function* getTimingForStaticAbilityPhasing(game) {
	const modificationActions = []; // the list of Apply/UnapplyStaticAbility actions that this will return as a timing.
	const activeCards = game.getActiveCards();
	const possibleTargets = activeCards.concat(game.players).concat(game);
	if (game.currentBlock() instanceof blocks.Fight) {
		possibleTargets.push(game.currentBlock().fight);
	}
	const abilityTargets = new Map(); // caches the abilities targets so they do not get recomputed

	// unapplying old modifiers
	for (const target of possibleTargets) {
		// unapplying old static abilities from this object
		for (const modifier of target.values.modifierStack) {
			// is this a regular static ability?
			if (!(modifier.ctx.ability instanceof abilities.StaticAbility)) continue;

			// has this ability been removed from its card?
			if (!modifier.ctx.card.values.current.abilities.includes(modifier.ctx.ability)) {
				modificationActions.push(new actions.UnapplyStaticAbility(
					modifier.ctx.card.currentOwner(), // have these be owned by the player that owns the card with the ability.
					target,
					modifier.ctx.ability
				));
				continue;
			}
			// else check if the object is still a valid target for the ability
			if (!abilityTargets.has(modifier.ctx.ability)) {
				abilityTargets.set(modifier.ctx.ability, modifier.ctx.ability.getTargets(modifier.ctx.card.currentOwner()));
			}
			if (!abilityTargets.get(modifier.ctx.ability).includes(target)) {
				modificationActions.push(new actions.UnapplyStaticAbility(
					modifier.ctx.card.currentOwner(), // have these be owned by the player that owns the card with the ability.
					target,
					modifier.ctx.ability
				));
			}
		}
	}

	// applying new modifiers
	const applicableAbilities = new Map();
	for (const currentCard of activeCards) {
		for (const ability of currentCard.values.current.abilities) {
			// is this a regular static ability?
			if (!(ability instanceof abilities.StaticAbility)) continue;

			if (!abilityTargets.has(ability)) {
				abilityTargets.set(ability, ability.getTargets(currentCard.currentOwner()));
			}
			for (const target of possibleTargets) {
				if (abilityTargets.get(ability).includes(target)) {
					if (!target.values.modifierStack.some(modifier => modifier.ctx.ability === ability)) {
						// abilities are just dumped in a list here to be sorted later.
						const abilities = applicableAbilities.get(target) ?? [];
						abilities.push(ability);
						applicableAbilities.set(target, abilities);
					}
				}
			}
		}
	}

	for (const [target, abilities] of applicableAbilities) {
		for (const ability of await (yield* orderStaticAbilities(target, abilities, game))) {
			modificationActions.push(new actions.ApplyStaticAbility(
				ability.card.currentOwner(), // have these be owned by the player that owns the card with the ability.
				target,
				ability.getModifier().bakeStatic(target)
			));
		}
	}

	if (modificationActions.length === 0) {
		return null;
	}
	return new Timing(game, modificationActions);
}

async function* orderStaticAbilities(target, abilities, game) {
	const orderedAbilities = [];

	const fieldEnterBuckets = {};
	for (let i = abilities.length - 1; i >= 0; i--) {
		// a card's own abilities go first.
		if (target instanceof BaseCard && abilities[i].card === target) {
			orderedAbilities.push(abilities[i]);
			abilities.splice(i, 1);
		} else {
			// otherwise the abilities get ordered by when they entered the field
			const lastMoved = abilities[i].zoneEnterTimingIndex;
			if (fieldEnterBuckets[lastMoved] === undefined) {
				fieldEnterBuckets[lastMoved] = [];
			}
			fieldEnterBuckets[lastMoved].push(abilities[i]);
		}
	}

	// sort abilities by when they were put on the field, then by category bucket. (whose field they are on)
	for (const timing of Object.keys(fieldEnterBuckets)) {
		let applyBuckets = [];
		switch (true) {
			case target instanceof BaseCard: { // applying to cards
				applyBuckets.push({player: target.currentOwner(), abilities: []}); // abilities on same side of field
				applyBuckets.push({player: target.currentOwner().next(), abilities: []}); // abilities on other side of field
				for (const ability of fieldEnterBuckets[timing]) {
					if (ability.card.currentOwner() === target.currentOwner()) {
						applyBuckets[0].abilities.push(ability);
					} else {
						applyBuckets[1].abilities.push(ability);
					}
				}
				break;
			}
			case target instanceof Player: { // applying to players
				applyBuckets.push({player: target, abilities: []}); // abilities on same side of field
				applyBuckets.push({player: target.next(), abilities: []}); // abilities on other side of field
				for (const ability of fieldEnterBuckets[timing]) {
					if (ability.card.currentOwner() === target) {
						applyBuckets[0].abilities.push(ability);
					} else {
						applyBuckets[1].abilities.push(ability);
					}
				}
				break;
			}
			default: { // applying to everything else (game processes like fights)
				applyBuckets.push({player: game.currentTurn().player, abilities: []}); // abilities owned by the turn player
				applyBuckets.push({player: game.currentTurn().player.next(), abilities: []}); // abilities owned by the non-turn player
				for (const ability of fieldEnterBuckets[timing]) {
					if (ability.card.currentOwner() === applyBuckets[0].player) {
						applyBuckets[0].abilities.push(ability);
					} else {
						applyBuckets[1].abilities.push(ability);
					}
				}
			}
		}

		// ordering abilities in the buckets
		for (const bucket of applyBuckets) {
			if (bucket.abilities.length === 0) continue;

			let ordering = [0];
			// is sorting necessary for this bucket?
			if (bucket.abilities.length !== 1) {
				const request = new ChooseAbilityOrder(bucket.player, target, bucket.abilities);
				const response = yield [request];
				ordering = await request.extractResponseValue(response);
			}
			// we got the order for the abilities
			for (const index of ordering) {
				orderedAbilities.push(bucket.abilities[index]);
			}
		}
	}

	return orderedAbilities;
}

// recalculates the values of every object currently in the game, according to their modifier stacks.
function recalculateObjectValues(game, isPrediction = false) {
	let valueChangeEvents = [];
	for (const object of game.pendingValueChangeObjects) {
		// for performance, ValueChangedEvents aren't generated during prediction since they won't be needed
		const oldValues = isPrediction? null : object.values.clone();
		const wasUnit = object instanceof BaseCard && object.values.current.cardTypes.includes("unit");

		recalculateModifiedValuesFor(object);

		// did a card stop being a unit?
		if (wasUnit && !object.values.current.cardTypes.includes("unit")) {
			object.canAttackAgain = false;
			for (let i = object.values.modifierStack.length - 1; i >= 0; i--) {
				if (object.values.modifierStack[i].removeUnitSpecificModifications()) {
					object.values.modifierStack.splice(i, 1);
				}
			}
		}

		// during prediction, events don't need to be created
		if (!isPrediction) {
			for (const property of oldValues.base.compareTo(object.values.base)) {
				valueChangeEvents.push(createValueChangedEvent(object, property, true));
			}
			for (const property of oldValues.current.compareTo(object.values.current)) {
				if (!valueChangeEvents.some(event => event.valueName === property && event.object === object)) {
					valueChangeEvents.push(createValueChangedEvent(object, property, false));
				}
			}
		}
	}
	game.pendingValueChangeObjects = game.pendingValueChangeObjects.filter(obj => obj.values.modifiedByStaticAbility);
	return valueChangeEvents;
}