import * as actions from "../actions.mjs";
import * as ast from "./astNodes.mjs";
import * as events from "../events.mjs";
import * as requests from "../inputRequests.mjs";
import * as zones from "../zones.mjs";
import {Card, BaseCard} from "../card.mjs";
import {nChooseK} from "../math.mjs";
import {ScriptValue, DeckPosition} from "./structs.mjs";
import {buildAST} from "./interpreter.mjs"
import {ActionReplaceModification} from "../valueModifiers.mjs";

// general helper functions

// compares two values for cdfScript equality
function equalityCompare(a, b) {
	if (a instanceof BaseCard && b instanceof BaseCard) {
		return a.globalId === b.globalId;
	}
	return a === b;
}
// Used by the MOVE() function, primarily to figure out which field zone a given card needs to return to.
function getZoneForCard(zoneList, card, ctx) {
	const rightType = [];
	for (const zone of zoneList) {
		if (zone instanceof zones.FieldZone) {
			switch (zone.type) {
				case "unit":
				case "partner": {
					if (card.values.current.cardTypes.includes("unit")) {
						rightType.push(zone);
					}
					break;
				}
				case "spellItem": {
					if (card.values.current.cardTypes.includes("spell") || card.values.current.cardTypes.includes("item")) {
						rightType.push(zone);
					}
					break;
				}
			}
		} else {
			rightType.push(zone);
		}
	}
	for (const zone of rightType) {
		// RULES: When a card is being returned to the field, it is returned to the player's field it was most recently on.
		// ルール：また、フィールドに戻す場合は直前に存在していたプレイヤー側のフィールドに置くことになります。
		if (zone instanceof zones.FieldZone) {
			if (zone.player === (card.lastFieldSidePlayer ?? ctx.player)) {
				return zone;
			}
		} else {
			if (zone.player === ctx.player) {
				return zone;
			}
		}
	}
	return rightType[0] ?? zoneList[0];
}

class ScriptFunction {
	// finalizeRetVal is used to 'post-process' the returned actions after they have been merged for players and executed.
	// It is only called for functions that return tempAction
	constructor(parameterTypes = [], defaultValues = [], returnType, func, hasAllTargets, funcFull, finalizeReturnValue = value => value) {
		this.parameterTypes = parameterTypes;
		this.defaultValues = defaultValues;
		this.returnType = returnType;
		this.run = func.bind(this);
		this.hasAllTargets = hasAllTargets.bind(this);
		this.runFull = funcFull?.bind(this);
		this.finalizeReturnValue = finalizeReturnValue.bind(this);
	}

	// gets the right astNode of the given type
	// a type of "*" indicates any type is fine
	getParameter(astNode, type = "*", index = 0) {
		let currentIndex = 0;
		for (const param of astNode.parameters) {
			if (type === "*" || type === param.returnType) {
				if (currentIndex === index) {
					return param;
				}
				currentIndex++;
			}
		}
		// If nothing is found in the parameters, look through defaults
		currentIndex = 0;
		for (let i = 0; i < this.defaultValues.length; i++) {
			if (type === "*" || type === this.parameterTypes[i]) {
				if (currentIndex === index) {
					return this.defaultValues[i];
				}
				currentIndex++;
			}
		}
	}
}

// common hasAllTargets functions
function hasCardTarget(astNode, ctx) { // for checking if any cards are available for the first card parameter
	for (const list of this.getParameter(astNode, "card").evalFull(ctx)) {
		if (list.get(ctx.player).length > 0) return true;
	}
	return false;
}
function alwaysHasTarget(astNode, ctx) {
	return true;
}

// all individual functions
export let functions = null;

export function initFunctions() {
	functions =
{
	APPLY: new ScriptFunction(
		["card", "player", "fight", "modifier", "untilIndicator"],
		[null, null, null, null, new ast.UntilIndicatorNode("forever")],
		"action",
		function*(astNode, ctx) {
			let until = (yield* this.getParameter(astNode, "untilIndicator").eval(ctx)).get(ctx.player);
			let applyActions = [];
			let objects = (yield* (
				this.getParameter(astNode, "card") ??
				this.getParameter(astNode, "player") ??
				this.getParameter(astNode, "fight")).eval(ctx));
			if (objects.type === "card") {
				objects = objects.get(ctx.player).map(card => card.current());
			} else {
				objects = objects.get(ctx.player);
			}
			for (const target of objects) {
				applyActions.push(new actions.ApplyStatChange(
					ctx.player,
					target,
					(yield* this.getParameter(astNode, "modifier").eval(ctx)).get(ctx.player).bake(target),
					until
				));
			}
			return new ScriptValue("tempActions", applyActions);
		},
		function(astNode, ctx) { // for checking if any cards are available for the first card parameter
			let target = this.getParameter(astNode, "card") ??
			             this.getParameter(astNode, "player") ??
			             this.getParameter(astNode, "fight");
			for (const list of target.evalFull(ctx)) {
				if (list.get(ctx.player).length > 0) return true;
			}
			return false;
		},
		undefined // TODO: Write evalFull
	),

	// Cancels an attack
	CANCELATTACK: new ScriptFunction(
		[],
		[],
		"action",
		function*(astNode, ctx) {
			return new ScriptValue("tempActions", [new actions.CancelAttack(ctx.player)]);
		},
		alwaysHasTarget,
		undefined // TODO: Write evalFull
	),

	// Counts the number of elements in the passed-in variable
	COUNT: new ScriptFunction(
		["*"],
		[null],
		"number",
		function*(astNode, ctx) {
			let list = (yield* this.getParameter(astNode).eval(ctx)).get(ctx.player);
			return new ScriptValue("number", [list.length]);
		},
		alwaysHasTarget,
		undefined // TODO: Write evalFull
	),

	// Damages the executing player
	DAMAGE: new ScriptFunction(
		["number"],
		[null],
		"number",
		function*(astNode, ctx) {
			return new ScriptValue("tempActions", [new actions.DealDamage(ctx.player, (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player)[0])]);
		},
		alwaysHasTarget,
		undefined, // TODO: Write evalFull
		function(action) {
			return [action.amount];
		}
	),

	// Returns the top X cards of the executing player's deck
	DECKTOP: new ScriptFunction(
		["number"],
		[null],
		"card",
		function*(astNode, ctx) {
			return new ScriptValue("card", ctx.player.deckZone.cards.slice(Math.max(0, ctx.player.deckZone.cards.length - (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player)[0]), ctx.player.deckZone.cards.length));
		},
		function(astNode, ctx) {
			if (astNode.asManyAsPossible) {
				return ctx.player.deckZone.cards.length > 0;
			}
			for (let amount of this.getParameter(astNode, "number").evalFull(ctx)) {
				if (ctx.player.deckZone.cards.length >= amount.get(ctx.player)[0]) {
					return true;
				}
			}
			return false;
		},
		function*(astNode, ctx) {
			for (const amount of (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player)) {
				yield new ScriptValue("card", ctx.player.deckZone.cards.slice(Math.max(0, ctx.player.deckZone.cards.length - amount[0]), ctx.player.deckZone.cards.length));
			}
		}
	),

	// Destroys the passed-in cards
	DESTROY: new ScriptFunction(
		["card"],
		[null],
		"card",
		function*(astNode, ctx) {
			let cards = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player).filter(card => card.current());
			let discards = cards.map(card => new actions.Discard(
				ctx.player,
				card.current(),
				new ScriptValue("dueToReason", ["effect"]),
				new ScriptValue("card", [ctx.card.snapshot()])
			));
			return new ScriptValue("tempActions", discards.concat(discards.map(discard => new actions.Destroy(discard))));
		},
		hasCardTarget,
		function*(astNode, ctx) {
			yield* this.getParameter(astNode, "card").evalFull(ctx);
		},
		function(action) {
			if (action instanceof actions.Destroy) {
				return [action.discard.card];
			}
		}
	),

	// Returns wether or not the elements in the passed-in variable are different.
	DIFFERENT: new ScriptFunction(
		["*"],
		[null],
		"bool",
		function*(astNode, ctx) {
			let list = (yield* this.getParameter(astNode, "*").eval(ctx)).get(ctx.player);
			if (list.length === 1) {
				return new ScriptValue("bool", true);
			}
			for (let i = 0; i < list.length - 1; i++) {
				for (let j = i + 1; j < list.length; j++) {
					if (equalityCompare(list[i], list[j])) {
						return new ScriptValue("bool", false);
					}
				}
			}
			return new ScriptValue("bool", true);
		},
		alwaysHasTarget,
		undefined // TODO: Write evalFull
	),

	// Discards the passed-in cards
	DISCARD: new ScriptFunction(
		["card"],
		[null],
		"card",
		function*(astNode, ctx) {
			return new ScriptValue("tempActions", (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player).filter(card => card.current()).map(card => new actions.Discard(
				ctx.player,
				card.current(),
				new ScriptValue("dueToReason", ["effect"]),
				new ScriptValue("card", [ctx.card.snapshot()])
			)));
		},
		hasCardTarget,
		function*(astNode, ctx) {
			yield* this.getParameter(astNode, "card").evalFull(ctx);
		},
		function(action) {
			return [action.card];
		}
	),

	// Executes a part ability, given its ID
	DOABILITY: new ScriptFunction(
		["abilityId"],
		[null],
		null,
		function*(astNode, ctx) {
			const abilityId = (yield* this.getParameter(astNode, "abilityId").eval(ctx)).get(ctx.player)[0];
			// Calling buildAST without a cdfScript or game is fine here since the ability has already been parsed
			yield* buildAST("exec", abilityId).eval(ctx);
		},
		function(astNode, ctx) {
			for (const abilityId of this.getParameter(astNode, "abilityId").evalFull(ctx)) {
				// Calling buildAST without a cdfScript or game is fine here since the ability has already been parsed
				if (buildAST("exec", abilityId.get(ctx.player)[0]).hasAllTargets(ctx)) return true;
			}
			return false;
		},
		undefined, // evalFull is not needed since this has no return value and is therefore never called from inside another function
		() => {} // this has no return value
	),

	// The executing player draws X cards
	DRAW: new ScriptFunction(
		["number"],
		[null],
		"card",
		function*(astNode, ctx) {
			let amount = (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player)[0];
			if (astNode.asManyAsPossible) {
				amount = Math.min(amount, ctx.player.deckZone.cards.length);
			}
			return new ScriptValue("tempActions", [new actions.Draw(ctx.player, amount)]);
		},
		alwaysHasTarget,
		undefined, // TODO: Write evalFull
		function(action) {
			return action.drawnCards;
		}
	),

	// Exiles the passed-in cards
	EXILE: new ScriptFunction(
		["card", "untilIndicator"],
		[null, new ast.UntilIndicatorNode("forever")],
		"card",
		function*(astNode, ctx) {
			let until = (yield* this.getParameter(astNode, "untilIndicator").eval(ctx)).get(ctx.player);
			return new ScriptValue("tempActions", (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player).filter(card => card.current()).map(card => new actions.Exile(ctx.player, card.current(), until)));
		},
		hasCardTarget,
		function*(astNode, ctx) {
			yield* this.getParameter(astNode, "card").evalFull(ctx);
		},
		function(action) {
			return [action.card];
		}
	),

	// The executing player gains X life
	GAINLIFE: new ScriptFunction(
		["number"],
		[null],
		"number",
		function*(astNode, ctx) {
			return new ScriptValue("tempActions", [new actions.GainLife(ctx.player, (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player)[0])]);
		},
		alwaysHasTarget,
		undefined, // TODO: Write evalFull
		function(action) {
			return [action.amount];
		}
	),

	// The executing player gains X mana
	GAINMANA: new ScriptFunction(
		["number"],
		[null],
		"number",
		function*(astNode, ctx) {
			return new ScriptValue("tempActions", [new actions.GainMana(ctx.player, (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player)[0])]);
		},
		alwaysHasTarget,
		undefined, // TODO: Write evalFull
		function(action) {
			return [action.amount];
		}
	),

	// Returns how many counters of the given type are on the given cards
	GETCOUNTERS: new ScriptFunction(
		["card", "counter"],
		[null, null],
		"number",
		function*(astNode, ctx) {
			const cards = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player);
			const type = (yield* this.getParameter(astNode, "counter").eval(ctx)).get(ctx.player)[0];

			let total = 0;
			for (const card of cards) {
				if (card.counters[type]) {
					total += card.counters[type];
				}
			}

			return new ScriptValue("number", [total]);
		},
		alwaysHasTarget,
		undefined // TODO: Write evalFull
	),

	// Allows the passed-in units to attack again
	GIVEATTACK: new ScriptFunction(
		["card"],
		[null],
		"action",
		function*(astNode, ctx) {
			let target = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player)[0];
			return new ScriptValue("tempActions", target.current()? [new actions.GiveAttack(ctx.player, target.current())] : []);
		},
		hasCardTarget,
		undefined // TODO: Write evalFull
	),

	// The executing player loses X life
	LOSELIFE: new ScriptFunction(
		["number"],
		[null],
		"number",
		function*(astNode, ctx) {
			return new ScriptValue("tempActions", [new actions.LoseLife(ctx.player, (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player)[0])]);
		},
		alwaysHasTarget,
		undefined, // TODO: Write evalFull
		function(action) {
			return [-action.amount];
		}
	),

	// The executing player loses X mana
	LOSEMANA: new ScriptFunction(
		["number"],
		[null],
		"number",
		function*(astNode, ctx) {
			return new ScriptValue("tempActions", [new actions.LoseMana(ctx.player, (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player)[0])]);
		},
		alwaysHasTarget,
		undefined, // TODO: Write evalFull
		function(action) {
			return [-action.amount];
		}
	),

	// Move cards from where they are to certain zone(s)
	MOVE: new ScriptFunction(
		["card", "zone"],
		[null, null],
		"card",
		function*(astNode, ctx) {
			const cards = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player);
			const moveActions = [];
			const zoneMoveCards = new Map();
			for (const card of cards) {
				ast.setImplicit([card], "card");
				const zoneValue = (yield* this.getParameter(astNode, "zone").eval(ctx)).get(ctx.player);
				const zone = getZoneForCard(zoneValue instanceof DeckPosition? zoneValue.decks : zoneValue, card, ctx);
				let index = (zone instanceof zones.FieldZone || zone instanceof zones.DeckZone)? null : -1;
				if (zoneValue instanceof DeckPosition) {
					console.log(zoneValue, zoneValue.decks, zone);
					index = zoneValue.isTop? -1 : 0;
				}
				moveActions.push(new actions.Move(ctx.player, card, zone, index));
				zoneMoveCards.set(zone, (zoneMoveCards.get(zone) ?? []).concat(card));
				ast.clearImplicit("card");
			}

			for (const [zone, cards] of zoneMoveCards.entries()) {
				const freeSlots = zone.getFreeSpaceCount();
				if (freeSlots < cards.length) {
					if (freeSlots.length === 0) {
						return new ScriptValue("tempActions", []);
					}
					const selectionRequest = new requests.chooseCards.create(ctx.player, cards, [freeSlots], "cardEffectMove:" + ctx.ability.id);
					const response = yield [selectionRequest];
					if (response.type != "chooseCards") {
						throw new Error("Incorrect response type supplied during card move selection. (expected \"chooseCards\", got \"" + response.type + "\" instead)");
					}
					const movedCards = requests.chooseCards.validate(response.value, selectionRequest);
					for (let i = moveActions.length - 1; i >= 0; i--) {
						if (moveActions[i].zone === zone && !movedCards.includes(moveActions[i].card)) {
							moveActions.splice(i, 1);
						}
					}
				}
			}

			return new ScriptValue("tempActions", moveActions);
		},
		hasCardTarget,
		function*(astNode, ctx) {
			yield* this.getParameter(astNode, "card").evalFull(ctx);
		},
		function(action) {
			return [action.card];
		}
	),

	// The executing player needs to order these cards
	ORDER: new ScriptFunction(
		["card"],
		[null],
		"card",
		function*(astNode, ctx) {
			let toOrder = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player);
			let orderRequest = new requests.orderCards.create(ctx.player, toOrder, "cardEffect:" + ctx.ability.id);
			let response = yield [orderRequest];
			if (response.type != "orderCards") {
				throw new Error("Incorrect response type supplied during card ordering. (expected \"orderCards\", got \"" + response.type + "\" instead)");
			}
			return new ScriptValue("card", requests.orderCards.validate(response.value, orderRequest).map(card => card.current().snapshot()));
		},
		alwaysHasTarget, // technically you can't order nothing but that should never matter in practice
		function*(astNode, ctx) {
			for (const toOrder of this.getParameter(astNode, "card").evalFull(ctx)) {
				const cards = toOrder.get(ctx.player);
				for (const order of nChooseK(cards.length, cards.length)) {
					yield new ScriptValue("card", order.map(i => cards[i]));
				}
			}
		}
	),

	// Puts X counters of a given type onto the given card(s)
	PUTCOUNTERS: new ScriptFunction(
		["card", "counter", "amount"],
		[null, null, null],
		"action",
		function*(astNode, ctx) {
			const cards = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player);
			const actionList = [];
			for (const card of cards) {
				const type = (yield* this.getParameter(astNode, "counter").eval(ctx)).get(ctx.player)[0];
				const amount = (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player)[0];
				actionList.push(new actions.ChangeCounters(ctx.player, card, type, amount));
			}
			return new ScriptValue("tempActions", actionList);
		},
		hasCardTarget,
		undefined // TODO: Write evalFull
	),

	// Removes X counters of a given type from the given card(s)
	REMOVECOUNTERS: new ScriptFunction(
		["card", "counter", "amount"],
		[null, null, null],
		"action",
		function*(astNode, ctx) {
			let cards = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player);
			const actionList = [];
			for (const card of cards) {
				const type = (yield* this.getParameter(astNode, "counter").eval(ctx)).get(ctx.player)[0];
				const amount = (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player)[0];
				actionList.push(new actions.ChangeCounters(ctx.player, card, type, -amount));
			}
			return new ScriptValue("tempActions", actionList);
		},
		hasCardTarget,
		undefined // TODO: Write evalFull
	),

	// Makes the executing player reveal the given card
	REVEAL: new ScriptFunction(
		["card"],
		[null],
		"card",
		function*(astNode, ctx) {
			return new ScriptValue("tempActions", (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player).map(card => new actions.Reveal(ctx.player, card)));
		},
		hasCardTarget,
		function*(astNode, ctx) {
			yield* this.getParameter(astNode, "card").evalFull(ctx);
		},
		function(action) {
			return [action.card];
		}
	),

	// Returns wether or not the elements in the passed-in variable are all the same.
	SAME: new ScriptFunction(
		["*"],
		[null],
		"bool",
		function*(astNode, ctx) {
			let list = (yield* this.getParameter(astNode, "*").eval(ctx)).get(ctx.player);
			if (list.length === 1) {
				return new ScriptValue("bool", true);
			}
			for (let i = 1; i < list.length; i++) {
				if (!equalityCompare(list[i], list[i-1])) {
					return new ScriptValue("bool", false);
				}
			}
			return new ScriptValue("bool", true);
		},
		alwaysHasTarget,
		undefined // TODO: Write evalFull
	),

	// Makes the executing player choose X cards from the given ones, either selecting at random or not.
	// The first bool parameter is a validator that takes any possible selection as implicit cards and returns whether
	// those conform to any additional constraints the card text imposes. (all having different names, for example)
	SELECT: new ScriptFunction(
		["number", "card", "bool", "bool"],
		[null, null, new ast.BoolNode("yes"), new ast.BoolNode("no")],
		"card",
		function*(astNode, ctx) {
			const choiceAmounts = (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player);
			const eligibleCards = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player);
			const atRandom = (yield* this.getParameter(astNode, "bool", 1).eval(ctx)).get(ctx.player);
			const validator = this.getParameter(astNode, "bool");
			// If the player can't choose enough and the card doesn't say 'as many as possible', no cards are chosen.
			const chooseAtLeast = (choiceAmounts === "any" || astNode.asManyAsPossible)? 1 : Math.min(...choiceAmounts);
			if (eligibleCards.length < chooseAtLeast) {
				return new ScriptValue("tempActions", []);
			}

			const selectAction = new actions.SelectCards(
				ctx.player,
				eligibleCards,
				choiceAmounts === "any"? [] : choiceAmounts,
				ctx.ability.id,
				cards => {
					ast.setImplicit(cards, "card");
					const result = validator.evalFull(ctx).next().value.get(ctx.player);
					ast.clearImplicit("card");
					return result;
				},
				atRandom
			);

			return new ScriptValue("tempActions", [selectAction]);
		},
		function(astNode, ctx) {
			// Use the full eval to see if there is any valid choices for the player.
			return !this.runFull(astNode, ctx).next().done;
		},
		function*(astNode, ctx) {
			for (let eligibleCards of this.getParameter(astNode, "card").evalFull(ctx)) {
				eligibleCards = eligibleCards.get(ctx.player);
				for (let choiceAmounts of this.getParameter(astNode, "number").evalFull(ctx)) {
					choiceAmounts = choiceAmounts.get(ctx.player);
					const chooseAtLeast = (choiceAmounts === "any" || astNode.asManyAsPossible)? 1 : Math.min(...choiceAmounts);

					if (eligibleCards.length < chooseAtLeast) continue;

					// expand 'any' to a list of all possible numbers
					if (choiceAmounts === "any") {
						choiceAmounts = [];
						for (let i = 1; i <= eligibleCards.length; i++) {
							choiceAmounts.push(i);
						}
					}

					const validator = this.getParameter(astNode, "bool");
					for (const amount of choiceAmounts) {
						if (amount > eligibleCards.length) continue;
						const cardLists = nChooseK(eligibleCards.length, amount).map(list => list.map(i => eligibleCards[i]));
						for (const list of cardLists) {
							ast.setImplicit(list, "card");
							if(validator.evalFull(ctx).next().value.get(ctx.player)) {
								yield new ScriptValue("card", list);
							}
							ast.clearImplicit("card");
						}
					}
				}
			}
		},
		function(action) {
			return action.selected;
		}
	),

	// Makes the executing player choose a type
	SELECTABILITY: new ScriptFunction(
		["abilityId"],
		[null],
		"abilityId",
		function*(astNode, ctx) {
			const selectionRequest = new requests.chooseAbility.create(ctx.player, ctx.ability.id, (yield* this.getParameter(astNode, "abilityId").eval(ctx)).get(ctx.player));
			const response = yield [selectionRequest];
			if (response.type != "chooseAbility") {
				throw new Error("Incorrect response type supplied during ability selection. (expected \"chooseAbility\", got \"" + response.type + "\" instead)");
			}
			const ability = requests.chooseType.validate(response.value, selectionRequest);
			yield [events.createAbilitySelectedEvent(ctx.player, ability)];
			return new ScriptValue("type", [ability]);
		},
		function(astNode, ctx) {
			// Use the full eval to see if there is any valid choices for the player.
			return !this.runFull(astNode, ctx).next().done;
		},
		function*(astNode, ctx) {
			const alreadyYielded = [];
			for (const abilities of this.getParameter(astNode, "abilityId").evalFull(ctx)) {
				for (const ability of abilities.get(ctx.player)) {
					if (alreadyYielded.includes(ability)) continue;
					yield new ScriptValue("abilityId", [ability]);
					alreadyYielded.push(ability);
				}
			}
		}
	),

	// Makes the executing player choose a type
	SELECTDECKSIDE: new ScriptFunction(
		["player"],
		[null],
		"zone",
		function*(astNode, ctx) {
			const selectionRequest = new requests.chooseDeckSide.create(ctx.player, ctx.ability.id, (yield* this.getParameter(astNode, "player").eval(ctx)).get(ctx.player)[0]);
			const response = yield [selectionRequest];
			if (response.type != "chooseDeckSide") {
				throw new Error("Incorrect response type supplied during type selection. (expected \"chooseDeckSide\", got \"" + response.type + "\" instead)");
			}
			const deckSide = requests.chooseDeckSide.validate(response.value, selectionRequest);
			yield [events.createDeckSideSelectedEvent(ctx.player, deckSide.isTop? "top" : "bottom")];
			return new ScriptValue("zone", deckSide);
		},
		alwaysHasTarget,
		function*(astNode, ctx) {
			for (const player of this.getParameter(astNode, "player").evalFull(ctx)) {
				const zone = player.get(ctx.player)[0].deckZone;
				yield new ScriptValue("zone", new DeckPosition(zone, true));
				yield new ScriptValue("zone", new DeckPosition(zone, false));
			}
		}
	),

	// Makes the executing player choose a player
	SELECTPLAYER: new ScriptFunction(
		[],
		[],
		"player",
		function*(astNode, ctx) {
			const selectionRequest = new requests.choosePlayer.create(ctx.player, "cardEffect:" + ctx.ability.id);
			const response = yield [selectionRequest];
			if (response.type != "choosePlayer") {
				throw new Error("Incorrect response type supplied during player selection. (expected \"choosePlayer\", got \"" + response.type + "\" instead)");
			}
			const chosenPlayer = requests.choosePlayer.validate(response.value, selectionRequest);
			yield [events.createPlayerSelectedEvent(ctx.player, chosenPlayer)];
			return new ScriptValue("player", [chosenPlayer]);
		},
		alwaysHasTarget,
		function*(astNode, ctx) {
			for (const player of ctx.game.players) {
				yield new ScriptValue("player", [player]);
			}
		}
	),

	// Makes the executing player choose a type
	SELECTTYPE: new ScriptFunction(
		["type"],
		[null],
		"type",
		function*(astNode, ctx) {
			const selectionRequest = new requests.chooseType.create(ctx.player, ctx.ability.id, (yield* this.getParameter(astNode, "type").eval(ctx)).get(ctx.player));
			const response = yield [selectionRequest];
			if (response.type != "chooseType") {
				throw new Error("Incorrect response type supplied during type selection. (expected \"chooseType\", got \"" + response.type + "\" instead)");
			}
			const type = requests.chooseType.validate(response.value, selectionRequest);
			yield [events.createTypeSelectedEvent(ctx.player, type)];
			return new ScriptValue("type", [type]);
		},
		function(astNode, ctx) {
			// Use the full eval to see if there is any valid choices for the player.
			return !this.runFull(astNode, ctx).next().done;
		},
		function*(astNode, ctx) {
			const alreadyYielded = [];
			for (const types of this.getParameter(astNode, "abilityId").evalFull(ctx)) {
				for (const type of types.get(ctx.player)) {
					if (alreadyYielded.includes(type)) continue;
					yield new ScriptValue("type", [type]);
					alreadyYielded.push(type);
				}
			}
		}
	),

	// Sets the attack target to the given card
	SETATTACKTARGET: new ScriptFunction(
		["card"],
		[null],
		"card",
		function*(astNode, ctx) {
			const newTarget = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player)[0];
			return new ScriptValue("tempActions", [new actions.SetAttackTarget(ctx.player, newTarget)]);
		},
		hasCardTarget,
		undefined, // TODO: Write evalFull
		function(action) {
			return [action.newTarget];
		}
	),

	// The executing player shuffles their deck without the given cards
	SHUFFLE: new ScriptFunction(
		["card"],
		[new ast.ValueNode([], "card")],
		"action",
		function*(astNode, ctx) {
			return new ScriptValue("tempActions", [new actions.Shuffle(ctx.player)]);
		},
		function(astNode, ctx) {
			const excludeCards = this.getParameter(astNode, "card")?.evalFull(ctx);
			if (!excludeCards) return ctx.player.deckZone.cards.length > 0;

			for (const cardList of excludeCards) {
				if (ctx.player.deckZone.cards.length > cardList.get(ctx.player).length) return true;
			}
			return false;
		},
		undefined // TODO: Write evalFull
	),

	// Sums up all the numbers in the variable passed to it
	SUM: new ScriptFunction(
		["number"],
		[null],
		"number",
		function*(astNode, ctx) {
			const list = (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player);
			let sum = 0;
			for (let num of list) {
				sum += num;
			}
			return new ScriptValue("number", [sum]);
		},
		alwaysHasTarget,
		undefined // TODO: Write evalFull
	),

	// Summons the given cards and applies the given modifier to the summoning process.
	// If a modifier is given, the bool refers to whether or not it is mandatory, otherwise it indicates whether or not the cost needs to be paid.
	SUMMON: new ScriptFunction(
		["card", "zone", "modifier", "bool"],
		[null, new ast.ZoneNode("unitZone", new ast.PlayerNode("you")), null, new ast.BoolNode("yes")],
		"card",
		function*(astNode, ctx) {
			let cards = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player);
			const zone = (yield* this.getParameter(astNode, "zone").eval(ctx)).get(ctx.player).find(zone => zone.type === "unit");
			const modifier = this.getParameter(astNode, "modifier")? (yield* this.getParameter(astNode, "modifier").eval(ctx)).get(ctx.player) : null;
			const boolParam = (yield* this.getParameter(astNode, "bool").eval(ctx)).get(ctx.player);

			// remove cards that can no longer be summoned
			for (let i = cards.length - 1; i >= 0; i--) {
				if (cards[i].current() === null) {
					cards.splice(i, 1);
				}
			}
			// make player choose which cards to summon if there is not enough space
			const freeZoneSlots = zone.getFreeSpaceCount();
			if (freeZoneSlots < cards.length) {
				// Not being able to summon enough units must interrupt the block
				if (freeZoneSlots === 0) return new ScriptValue("tempActions", []);
				if (!astNode.asManyAsPossible) return new ScriptValue("tempActions", []);

				const selectionRequest = new requests.chooseCards.create(ctx.player, cards, [freeZoneSlots], "cardEffectSummon:" + ctx.ability.id);
				const response = yield [selectionRequest];
				if (response.type != "chooseCards") {
					throw new Error("Incorrect response type supplied during card summon selection. (expected \"chooseCards\", got \"" + response.type + "\" instead)");
				}
				cards = requests.chooseCards.validate(response.value, selectionRequest);
			}

			const costs = [];
			const placeActions = [];


			for (let i = 0; i < cards.length; i++) {
				if (cards[i].current() === null) {
					continue;
				}
				const placeCost = new actions.Place(ctx.player, cards[i], zone);
				placeCost.costIndex = i;
				costs.push(placeCost);
				placeActions.push(placeCost);

				if (modifier || boolParam) {
					const costActions = cards[i].getSummoningCost(ctx.player);
					// TODO: Figure out if this needs to account for multi-action costs and how to handle those.
					for (const actionList of costActions) {
						for (const action of actionList) {
							action.costIndex = i;
							costs.push(action);
						}
					}

					// Apply cost modifications
					// only replacements are valid SUMMON() cost modifications
					// cancels could also be made to work but they seem unneccessary due to how the bool parameter works
					if (modifier?.modifications[0] instanceof ActionReplaceModification) {
						for (const action of costs) {
							// can this modification be applied to this cost action?
							ast.setImplicit([action], "action");
							const doesMatch = (yield* modifier.modifications[0].toModify.eval(modifier.ctx)).get();
							ast.clearImplicit("action");
							if (!doesMatch) continue;

							// gather replacements
							let replacements;
							ast.setImplicit([action], "action");
							for (const output of modifier.modifications[0].replacement.eval(modifier.ctx)) {
								if (output[0] instanceof actions.Action) {
									replacements = output;
									break;
								}
								yield output;
							}
							ast.clearImplicit("action");

							// ask player if they want to apply optional modification
							if (!boolParam) {
								// TODO: modify this to fit here
								//const response = yield [applyActionModificationAbility.create(ability.card.currentOwner(), ability, target)];
								//response.value = applyActionModificationAbility.validate(response.value);
								//if (!response.value) continue;
							}

							// apply the modification, then stop iterating
							actions.replaceActionInList(costs, action, replacements);
							break;
						}
					}
				}
			}

			const timing = yield costs;
			const summons = [];
			for (let i = 0; i < timing.costCompletions.length; i++) {
				if (timing.costCompletions[i]) {
					summons.push(new actions.Summon(
						ctx.player,
						placeActions[i],
						new ScriptValue("dueToReason", "effect"),
						new ScriptValue("by", ctx.card)
					));
				}
			}
			return new ScriptValue("tempActions", summons);
		},
		hasCardTarget,
		undefined, // TODO: Write evalFull
		function(action) {
			return [action.card];
		}
	),

	// summons some number of the specified tokens to the given zone
	SUMMONTOKENS: new ScriptFunction(
		["number", "cardId", "number", "type", "number", "number", "abilityId", "zone"],
		[null, null, null, null, null, null, new ast.ValueNode([], "abilityId"), new ast.ZoneNode("unitZone", new ast.PlayerNode("you"))],
		"card",
		function*(astNode, ctx) {
			const amounts = (yield* this.getParameter(astNode, "number", 0).eval(ctx)).get(ctx.player);
			const name = (yield* this.getParameter(astNode, "cardId", 0).eval(ctx)).get(ctx.player);
			const level = (yield* this.getParameter(astNode, "number", 1).eval(ctx)).get(ctx.player)[0];
			const types = (yield* this.getParameter(astNode, "type", 0).eval(ctx)).get(ctx.player);
			const attack = (yield* this.getParameter(astNode, "number", 2).eval(ctx)).get(ctx.player)[0];
			const defense = (yield* this.getParameter(astNode, "number", 3).eval(ctx)).get(ctx.player)[0];
			const abilities = (yield* this.getParameter(astNode, "abilityId", 0).eval(ctx)).get(ctx.player);

			const zone = (yield* this.getParameter(astNode, "zone").eval(ctx)).get(ctx.player).find(zone => zone.type === "unit");

			// get how many tokens to summon
			let amount;
			if (amounts === "any") {
				amount = Infinity;
			} else if (amounts.length === 1) {
				amount = amounts[0];
			} else {
				const selectionRequest = new requests.selectTokenAmount.create(ctx.player, amounts);
				const response = yield [selectionRequest];
				if (response.type != "selectTokenAmount") {
					throw new Error("Incorrect response type supplied during token amount selection. (expected \"selectTokenAmount\", got \"" + response.type + "\" instead)");
				}
				amount = requests.selectTokenAmount.validate(response.value, selectionRequest);
			}

			const freeSpaces = zone.getFreeSpaceCount()
			if (amount > freeSpaces && !astNode.asManyAsPossible) {
				// Not being able to summon enough tokens must interrupt the block
				return new ScriptValue("tempActions", []);
			}

			// create those tokens
			const cards = [];
			for (let i = Math.min(amount, freeSpaces); i > 0; i--) {
				// TODO: Give player control over the specific token variant that gets selected
				let tokenCdf = `id: CU${name}
cardType: token
name: CU${name}
level: ${level}
types: ${types.join(",")}
attack: ${attack}
defense: ${defense}`;
				for (const ability of abilities) {
					tokenCdf += "\no: CU" + ability;
				}
				cards.push(new Card(ctx.player, tokenCdf));
			}

			// TODO: unify all this with the one from the SUMMON function once that gets more in-depth
			const costs = [];
			const placeActions = [];
			for (let i = 0; i < cards.length; i++) {
				const placeCost = new actions.Place(ctx.player, cards[i], zone);
				placeCost.costIndex = i;
				costs.push(placeCost);
				placeActions.push(placeCost);

				const costActions = cards[i].getSummoningCost(ctx.player);
				// TODO: Figure out if this needs to account for multi-action costs and how to handle those.
				for (const actionList of costActions) {
					for (const action of actionList) {
						action.costIndex = i;
						costs.push(action);
					}
				}
			}
			const timing = yield costs;
			const summons = [];
			for (let i = 0; i < timing.costCompletions.length; i++) {
				if (timing.costCompletions[i]) {
					summons.push(new actions.Summon(
						ctx.player,
						placeActions[i],
						new ScriptValue("dueToReason", "effect"),
						new ScriptValue("by", ctx.card)
					));
				}
			}
			return new ScriptValue("tempActions", summons);
		},
		alwaysHasTarget,
		undefined, // TODO: Write evalFull
		function(action) {
			return [action.card];
		}
	),

	// Swaps two cards with eachother
	SWAP: new ScriptFunction(
		["card", "card", "bool"],
		[null, null, new ast.BoolNode("no")],
		"action",
		function*(astNode, ctx) {
			let cardA = (yield* this.getParameter(astNode, "card", 0).eval(ctx)).get(ctx.player)[0];
			let cardB = (yield* this.getParameter(astNode, "card", 1).eval(ctx)).get(ctx.player)[0];
			let transferEquipments = (yield* this.getParameter(astNode, "bool").eval(ctx)).get(ctx.player);

			return new ScriptValue("tempActions", [new actions.Swap(ctx.player, cardA, cardB, transferEquipments)]);
		},
		function(astNode, ctx) {
			let hasCardA = false;
			for (const cardList of this.getParameter(astNode, "card", 0).evalFull(ctx)) {
				if (cardList.get(ctx.player).length > 0) {
					hasCardA = true;
					break;
				}
			}
			if (!hasCardA) return false;

			let hasCardB = false;
			for (const cardList of this.getParameter(astNode, "card", 1).evalFull(ctx)) {
				if (cardList.get(ctx.player).length > 0) {
					hasCardB = true;
					break;
				}
			}
			return hasCardB;
		},
		undefined // TODO: Write evalFull
	),

	// Swaps two cards with eachother
	VIEW: new ScriptFunction(
		["card"],
		[null],
		"card",
		function*(astNode, ctx) {
			return new ScriptValue("tempActions", (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player).filter(card => card.current()).map(card => new actions.View(ctx.player, card.current())));
		},
		hasCardTarget,
		function*(astNode, ctx) {
			yield* this.getParameter(astNode, "card").evalFull(ctx);
		},
		function(action) {
			return [action.card];
		}
	)
}
};