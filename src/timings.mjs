
import {createActionCancelledEvent, createValueChangedEvent, createActionModificationAbilityAppliedEvent} from "./events.mjs";
import {chooseAbilityOrder, chooseCards, applyActionModificationAbility} from "./inputRequests.mjs";
import {Player} from "./player.mjs";
import {ScriptContext, ScriptValue} from "./cdfScriptInterpreter/structs.mjs";
import {BaseCard} from "./card.mjs";
import {recalculateModifiedValuesFor, ActionReplaceModification, ActionModification} from "./valueModifiers.mjs";
import * as abilities from "./abilities.mjs";
import * as blocks from "./blocks.mjs";
import * as phases from "./phases.mjs";
import * as actions from "./actions.mjs";
import * as zones from "./zones.mjs";
import * as ast from "./cdfScriptInterpreter/astNodes.mjs";

// Represents a single instance in time where multiple actions take place at once.
export class Timing {
	constructor(game, actionList) {
		this.game = game;
		this.index = 0;
		this.actions = actionList;
		for (const action of this.actions) {
			action.timing = this;
		}
		this.costCompletions = [];
		this.successful = false;
		this.followupTiming = null;
		// The static action modification abilities that were applied during this timing.
		// This needs to be tracked for those that can only be activated once per game.
		this.staticAbilitiesApplied = [];
	}

	// cancels the given action and any implied actions and returns the actionCancelledEvents for all of them
	_cancelAction(action) {
		const events = [];
		for (const cancelled of action.setIsCancelled()) {
			events.push(createActionCancelledEvent(cancelled));
			if (cancelled.costIndex >= 0) {
				this.costCompletions[cancelled.costIndex] = false;
			}
		}
		return events;
	}

	// returns a list of actionCancelled events and sets impossible actions to cancelled
	_cancelImpossibleActions() {
		let events = [];
		for (const action of this.actions) {
			if (action.isCancelled) continue;
			if (action.isImpossible()) {
				events = events.concat(this._cancelAction(action));
			}
		}
		return events;
	}

	// applies static abilities like that on 'Substitution Doll' or 'Norma, of the Sandstorm'
	* _handleModificationAbilities() {
		// gather abilities
		const activeCards = this.game.players.map(player => player.getAllCards()).flat();
		const possibleTargets = activeCards.concat(this.game.players);
		const applicableAbilities = new Map();
		const targets = new Map(); // cards that modification abilities will apply tozz
		for (const player of this.game.players) {
			targets.set(player, []);
		}
		for (const currentCard of activeCards) {
			for (const ability of currentCard.values.current.abilities) {
				if (ability instanceof abilities.StaticAbility && ability.getModifier().modifications[0] instanceof ActionModification) {
					if (!ability.canApply(currentCard, currentCard.currentOwner())) continue;

					// go through all targets that this ability could apply to
					const eligibleTargets = ability.getTargets(currentCard.currentOwner());
					if (eligibleTargets.length === 0) continue;

					// add all the targets
					for (const target of possibleTargets) {
						if (!eligibleTargets.includes(target)) continue;

						// check if there is an action that this ability could apply to for this card
						const modifier = ability.getModifier();

						// for replacement abilities, we need to figure out if the replacement is not already happening.
						if (modifier.modifications[0] instanceof ActionReplaceModification) {
							let replacements;
							let replacementsValid = true;
							// TODO: This currently yields requests to the user but should ideally play through all options to figure out if a valid
							//       replacement can be constructed. This does not currently matter on any official cards.
							// TODO: evaluating the replacement needs to have the replaced action as an implicit one so this needs to be moved down into the actions loop
							//       (this currently does not matter on any implemented cards)
							for (const output of modifier.modifications[0].replacement.eval(modifier.ctx)) {
								if (output[0] instanceof actions.Action) {
									replacements = output;
									for (const action of this.actions) {
										for (const replacement of replacements) {
											if (action.isIdenticalTo(replacement)) replacementsValid = false;
										}
									}
									break;
								}
								yield output;
							}
							if (!replacementsValid) continue;
						}

						let foundMatching = false;
						for (const action of this.actions) {
							// can't modify cancelled actions as they are not about to happen
							if (action.isCancelled) continue;

							ast.setImplicit([action], "action");
							ast.setImplicit([target], "card");
							const doesMatch = (yield* modifier.modifications[0].toModify.eval(modifier.ctx)).get();
							ast.clearImplicit("card");
							ast.clearImplicit("action");
							if (doesMatch) {
								foundMatching = true;
								break;
							}
						}
						if (!foundMatching) continue;

						// abilities are just dumped in a list here to be sorted later.
						const abilities = applicableAbilities.get(target) ?? [];
						abilities.push(ability);
						applicableAbilities.set(target, abilities);
						// also keep track of which targets will need to be affected
						const oldTargets = targets.get(target.currentOwner());
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
					const request = chooseCards.create(player, remainingCards, [1], "nextCardToApplyStaticAbilityTo");
					const response = yield [request];
					if (response.type != "chooseCards") {
						throw new Error("Wrong response type supplied during action modification application (expected 'chooseCards', got '" + response.type + "')");
					}
					target = chooseCards.validate(response.value, request)[0];
				} else {
					target = remainingCards[0];
				}
				remainingCards.splice(remainingCards.indexOf(target), 1);

				// apply modifications to this card
				for (const ability of yield* orderStaticAbilities(target, applicableAbilities.get(target), this.game)) {
					const modifier = ability.getModifier();
					let didApply = false;
					for (let i = 0; i < this.actions.length; i++) {
						// can't modify cancelled actions as they are not about to happen
						if (this.actions[i].isCancelled) continue;

						ast.setImplicit([this.actions[i]], "action");
						ast.setImplicit([target], "card");
						const doesMatch = (yield* modifier.modifications[0].toModify.eval(modifier.ctx)).get();
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

								if (!replacement.isFullyPossible()) {
									foundInvalidReplacement = true;
									break;
								}
							}
							if (foundInvalidReplacement) continue;
						}

						// ask player if they want to apply optional modification
						if (!ability.mandatory) {
							const response = yield [applyActionModificationAbility.create(ability.card.currentOwner(), ability, target)];
							response.value = applyActionModificationAbility.validate(response.value);
							if (!response.value) continue;
						}

						// apply the modification
						yield [createActionModificationAbilityAppliedEvent(ability)];
						if (modifier.modifications[0] instanceof ActionReplaceModification) {
							actions.replaceActionInList(this.actions, this.actions[i], replacements);
						} else { // cancel ability instead
							yield this._cancelAction(this.actions[i]);
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

	isFullyPossible(costIndex) {
		for (const action of this.actions) {
			if (action.costIndex === costIndex && (!action.isFullyPossible() || action.isCancelled)) {
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
		const cancelEvents = this._cancelImpossibleActions();
		if (cancelEvents.length > 0) {
			yield cancelEvents;
		}

		// apply static substitution abilities to the rest
		yield* this._handleModificationAbilities();

		if (this.costCompletions.length > 0) {
			// empty costs count as successful completion
			if (this.actions.length === 0 && this.costCompletions.includes(true)) {
				this.successful = true;
				return;
			}
			for (let i = 0; i < this.costCompletions.length; i++) {
				this.costCompletions[i] = this.costCompletions[i] && this.isFullyPossible(i);
			}
			for (const action of this.actions) {
				if (!this.costCompletions[action.costIndex]) {
					action.isCancelled = true;
				}
			}
		}
		// fully cancelled timings are not successful, they interrupt their block or indicate that paying all costs failed.
		if (!this.actions.find(action => !action.isCancelled)) {
			this.game.nextTimingIndex--;
			return;
		}

		// sometimes actions prompt certain other actions to be performed at the same time
		// TODO: These need to be checked for legality and substitution just like the original actions
		let followupActions = this.actions;
		do {
			followupActions = this.getFollowupActions(followupActions);
			for (const action of followupActions) {
				this.actions.push(action);
			}
		} while (followupActions.length > 0);

		// check trigger ability preconditions
		if (!isPrediction) {
			if (this.game.currentPhase() instanceof phases.StackPhase) {
				for (const player of this.game.players) {
					for (const card of player.getAllCards()) {
						for (const ability of card.values.current.abilities) {
							if (ability instanceof abilities.TriggerAbility ||
								ability instanceof abilities.CastAbility) {
								ability.checkTriggerPrecondition(player);
							}
						}
					}
				}
			}
		}

		// run actions and collect events
		let events = [];
		for (const action of this.actions) {
			if (action.isCancelled) continue;

			const event = await (yield* action.run());
			if (event) {
				events.push(event);
			}
		}

		if (events.length > 0) {
			yield events;
		}

		this.successful = true;
		this.game.currentPhase().lastActionList = this.actions;

		// TODO: The following things do not have proper undo support yet.
		// This *should* only matter when units turn into spells/items so for now it does not matter(?)
		// (That's because in those cases, modifiers on the card are destroyed and wouldn't properly get restored)
		const valueChangeEvents = recalculateObjectValues(this.game);
		if (valueChangeEvents.length > 0) {
			yield valueChangeEvents;
		}
		this.game.currentAttackDeclaration?.removeInvalidAttackers();

		if (!isPrediction) {
			// check win/lose conditions
			yield* this.game.checkGameOver();

			// check trigger ability conditions
			if (this.game.currentPhase() instanceof phases.StackPhase) {
				for (let player of this.game.players) {
					for (let card of player.getAllCards()) {
						for (let ability of card.values.current.abilities) {
							if (ability instanceof abilities.TriggerAbility ||
								ability instanceof abilities.CastAbility) {
								ability.checkTrigger(player);
							}
						}
					}
				}
			}
		}

		this.followupTiming = await (yield* runInterjectedTimings(this.game, isPrediction, this.actions));
	}

	* undo() {
		// check if this timing actually ran
		if (!this.successful) {
			return;
		}
		let events = [];
		for (let i = this.actions.length - 1; i >= 0; i--) {
			const event = this.actions[i].undo();
			if (event) {
				events.push(event);
			}
		}
		const valueChangeEvents = recalculateObjectValues(this.game);
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
			if (!allActions.find(action => action instanceof actions.Shuffle && action.player === deck.player)) {
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
				if (!this.actions.find(action => action instanceof actions.Discard && action.card === equipment)) {
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
			return discards.concat(discards.map(discard => new actions.Destroy(discard)));
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
	const timing = yield* getStaticAbilityPhasingTiming(game);
	if (timing) {
		await (yield* timing.run(isPrediction));
	}
	return timing;
}

// iterates over all static abilities and activates/deactivates those that need it.
function* getStaticAbilityPhasingTiming(game) {
	const modificationActions = []; // the list of Apply/UnapplyStaticAbility actions that this will return as a timing.
	const activeCards = game.players.map(player => player.getActiveCards()).flat();
	const possibleTargets = activeCards.concat(game.players);
	if (game.currentBlock() instanceof blocks.Fight) {
		possibleTargets.push(game.currentBlock().fight);
	}
	const abilityTargets = new Map(); // caches the abilities targets so they do not get recomputed

	// unapplying old modifiers
	for (const target of possibleTargets) {
		// unapplying old static abilities from this object
		for (const modifier of target.values.modifierStack) {
			// is this a regular static ability?
			if (!(modifier.ctx.ability instanceof abilities.StaticAbility) || (modifier.modifications[0] instanceof ActionModification)) continue;

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
			if (!(ability instanceof abilities.StaticAbility) || (ability.getModifier().modifications[0] instanceof ActionModification)) continue;

			if (!abilityTargets.has(ability)) {
				abilityTargets.set(ability, ability.getTargets(currentCard.currentOwner()));
			}
			for (const target of possibleTargets) {
				if (abilityTargets.get(ability).includes(target)) {
					if (!target.values.modifierStack.find(modifier => modifier.ctx.ability === ability)) {
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
		for (const ability of yield* orderStaticAbilities(target, abilities, game)) {
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

function* orderStaticAbilities(target, abilities, game) {
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
				const request = chooseAbilityOrder.create(bucket.player, target, bucket.abilities);
				const response = yield [request];
				if (response.type != "chooseAbilityOrder") {
					throw new Error("Wrong response type supplied during ability ordering (expected 'chooseAbilityOrder', got '" + response.type + "')");
				}
				ordering = chooseAbilityOrder.validate(response.value, request);
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
// TODO: generalize this somehow. Should probably generate a list of modifiables and loop over those
function recalculateObjectValues(game) {
	let valueChangeEvents = [];
	for (const player of game.players) {
		// recalculate the player's own values
		const oldPlayerValues = player.values.clone();
		recalculateModifiedValuesFor(player);
		for (const property of oldPlayerValues.base.compareTo(player.values.base)) {
			valueChangeEvents.push(createValueChangedEvent(player, property, true));
		}
		for (const property of oldPlayerValues.current.compareTo(player.values.current)) {
			valueChangeEvents.push(createValueChangedEvent(player, property, false));
		}

		// recalculate the values for the player's cards
		for (const card of player.getActiveCards()) {
			const oldCard = card.snapshot();
			const wasUnit = card.values.current.cardTypes.includes("unit");
			recalculateModifiedValuesFor(card);
			// once done, unit specific modifications may need to be removed.
			if (wasUnit && !card.values.current.cardTypes.includes("unit")) {
				card.canAttackAgain = false;
				for (let i = card.values.modifierStack.length - 1; i >= 0; i--) {
					if (card.values.modifierStack[i].removeUnitSpecificModifications()) {
						card.values.modifierStack.splice(i, 1);
					}
				}
			}

			for (const property of oldCard.values.base.compareTo(card.values.base)) {
				valueChangeEvents.push(createValueChangedEvent(card, property, true));
			}
			for (const property of oldCard.values.current.compareTo(card.values.current)) {
				if (valueChangeEvents.find(event => event.valueName === property && event.card === card) === undefined) {
					valueChangeEvents.push(createValueChangedEvent(card, property, false));
				}
			}
		}
	}
	if (game.currentBlock() instanceof blocks.Fight) {
		// TODO: Not duplicating the ValueChangedEvent code until this gets generalized
		recalculateModifiedValuesFor(game.currentBlock().fight);
	}
	return valueChangeEvents;
}