import * as actions from "../actions.mjs";
import * as ast from "./astNodes.mjs";
import * as requests from "../inputRequests.mjs";
import * as zones from "../zones.mjs";
import {Card} from "../card.mjs";
import {nChooseK} from "../math.mjs";
import {ScriptValue, DeckPosition, SomeOrMore, equalityCompare} from "./structs.mjs";
import {buildAST} from "./interpreter.mjs"
import {ActionReplaceModification} from "../valueModifiers.mjs";

// general helper functions

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

// returns only the given actions that are still in the step and not cancelled
function getSuccessfulActions(step, actionList) {
	const retVal = [];
	for (const action of step.actions) {
		if (!action.isCancelled && actionList.includes(action)) {
			retVal.push(action);
		}
	}
	return retVal;
}

class ScriptFunction {
	constructor(parameterTypes = [], defaultValues = [], returnType, func, hasAllTargets, funcFull) {
		this.parameterTypes = parameterTypes;
		this.defaultValues = defaultValues;
		this.returnType = returnType;
		this.run = func.bind(this);
		this.hasAllTargets = hasAllTargets.bind(this);
		// this should retun all the possible return values of this function
		this.runFull = funcFull?.bind(this);
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
	// Applies a modification to a card
	APPLY: new ScriptFunction(
		["card", "player", "fight", "modifier", "timeIndicator"],
		[null, null, null, null, new ast.ForeverNode()],
		null,
		function*(astNode, ctx) {
			let until = (yield* this.getParameter(astNode, "timeIndicator").eval(ctx)).get(ctx.player);
			let applyActions = [];
			let objectParam = this.getParameter(astNode, "card") ??
			                  this.getParameter(astNode, "player") ??
			                  this.getParameter(astNode, "fight");
			let objectValue = null;
			if (objectParam) {
				objectValue = (yield* objectParam.eval(ctx));
			}

			let objects = objectParam? objectValue.get(ctx.player) : [ctx.game];
			if (objectValue?.type === "card") {
				objects = objects.map(card => card.current());
			}
			for (const target of objects) {
				// targets that don't exist anymore can't be modified
				if (!target) continue;
				applyActions.push(new actions.ApplyStatChange(
					ctx.player,
					target,
					(yield* this.getParameter(astNode, "modifier").eval(ctx)).get(ctx.player).bake(target),
					until[0].getGeneratorList(ctx.game),
					new ScriptValue("dueToReason", ["effect"]),
					new ScriptValue("card", [ctx.card])
				));
			}
			yield applyActions;
		},
		function(astNode, ctx) { // for checking if any cards are available for the first card parameter
			let target = this.getParameter(astNode, "card") ??
			             this.getParameter(astNode, "player") ??
			             this.getParameter(astNode, "fight");
			if (!target) return true; // applying to game
			for (const list of target.evalFull(ctx)) {
				if (list.get(ctx.player).length > 0) return true;
			}
			return false;
		},
		undefined // TODO: Write evalFull
	),

	// Checks if there exist X cards in the given location that satisfy a given condition
	ARE:  new ScriptFunction(
		["number", "card", "bool"],
		[null, null, new ast.ValueNode([true], "bool")],
		"bool",
		function*(astNode, ctx) {
			let eligibleAmounts = (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player);
			const eligibleCards = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player);

			// If there isn't even enough cards, return false.
			const chooseAtLeast = astNode.asManyAsPossible?
			                      1 : eligibleAmounts instanceof SomeOrMore?
								  eligibleAmounts.lowest : Math.min(...eligibleAmounts);
			if (eligibleCards.length < chooseAtLeast) {
				return new ScriptValue("bool", [false]);
			}

			// clamp 'any' (or 'X+') to the amount of cards we have available
			if (eligibleAmounts instanceof SomeOrMore) {
				const newAmounts = [];
				for (let i = eligibleAmounts.lowest; i <= eligibleCards.length; i++) {
					newAmounts.push(i);
				}
				eligibleAmounts = newAmounts;
			}

			const validator = this.getParameter(astNode, "bool");
			for (const amount of eligibleAmounts) {
				if (amount > eligibleCards.length) continue;
				const cardLists = nChooseK(eligibleCards.length, amount).map(list => list.map(i => eligibleCards[i]));
				for (const list of cardLists) {
					ast.setImplicit(list, "card");
					if(validator.evalFull(ctx).next().value.getJsBool(ctx.player)) {
						return new ScriptValue("bool", [true]);
					}
					ast.clearImplicit("card");
				}
			}

			return new ScriptValue("bool", [false]);
		},
		alwaysHasTarget,
		undefined // TODO: Write evalFull
	),

	// Cancels an attack
	CANCELATTACK: new ScriptFunction(
		[],
		[],
		null,
		function*(astNode, ctx) {
			yield [new actions.CancelAttack(
				ctx.player,
				new ScriptValue("dueToReason", ["effect"]),
				new ScriptValue("card", [ctx.card])
			)];
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
		["player", "number"],
		[new ast.PlayerNode("own"), null],
		"number",
		function*(astNode, ctx) {
			const damageActions = [];
			for (const player of (yield* this.getParameter(astNode, "player").eval(ctx)).get(ctx.player)) {
				ast.setImplicit([player], "player");
				const amount = (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player)[0];
				ast.clearImplicit("player");
				damageActions.push(new actions.DealDamage(
					ctx.player,
					player,
					amount,
					new ScriptValue("dueToReason", ["effect"]),
					new ScriptValue("card", [ctx.card.snapshot()])
				));
			}

			const step = yield [...damageActions];
			return new ScriptValue("number", getSuccessfulActions(step, damageActions).map(action => action.amount));
		},
		alwaysHasTarget,
		undefined // TODO: Write evalFull
	),

	// Returns the top X cards of the executing player's deck
	DECKTOP: new ScriptFunction(
		["player", "number"],
		[new ast.PlayerNode("own"), null],
		"card",
		function*(astNode, ctx) {
			const players = (yield* this.getParameter(astNode, "player").eval(ctx)).get(ctx.player);
			const amount = (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player)[0];
			let cards = [];
			for (const player of players) {
				if (!astNode.asManyAsPossible && player.deckZone.cards.length < amount) {
					yield []; // interrupts the effect
				}
				cards = cards.concat(
					player.deckZone.cards.slice(
						Math.max(0, player.deckZone.cards.length - amount),
						player.deckZone.cards.length
					)
				);
			}
			return new ScriptValue("card", cards);
		},
		function(astNode, ctx) {
			if (astNode.asManyAsPossible) {
				return ctx.player.deckZone.cards.length > 0;
			}
			for (const amount of this.getParameter(astNode, "number").evalFull(ctx)) {
				if (ctx.player.deckZone.cards.length >= amount.get(ctx.player)[0]) {
					return true;
				}
			}
			return false;
		},
		function*(astNode, ctx) {
			for (const amount of this.getParameter(astNode, "number").evalFull(ctx)) {
				yield new ScriptValue("card", ctx.player.deckZone.cards.slice(Math.max(0, ctx.player.deckZone.cards.length - amount.get(ctx.player)[0]), ctx.player.deckZone.cards.length));
			}
		}
	),

	// Destroys the passed-in cards
	DESTROY: new ScriptFunction(
		["card"],
		[null],
		"card",
		function*(astNode, ctx) {
			const cards = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player).filter(card => card.current());
			const discards = cards.map(card => new actions.Discard(
				ctx.player,
				card.current(),
				new ScriptValue("dueToReason", ["effect"]),
				new ScriptValue("card", [ctx.card.snapshot()])
			));

			const actionList = discards.concat(discards.map(discard => new actions.Destroy(discard)));
			const step = yield [...actionList];
			const returnCards = [];
			for (const action of getSuccessfulActions(step, actionList)) {
				if (action instanceof actions.Destroy) {
					returnCards.push(action.discard.card);
				}
			}
			return new ScriptValue("card", returnCards);
		},
		hasCardTarget,
		function*(astNode, ctx) {
			yield* this.getParameter(astNode, "card").evalFull(ctx);
		}
	),

	// Returns wether or not the elements in the passed-in variable are different.
	DIFFERENT: new ScriptFunction(
		["*"],
		[null],
		"bool",
		function*(astNode, ctx) {
			let list = (yield* this.getParameter(astNode, "*").eval(ctx)).get(ctx.player);
			switch (list.length) {
				case 0: { // nothing is not different from itself
					return new ScriptValue("bool", [false]);
				}
				case 1: {
					return new ScriptValue("bool", [true]);
				}
				default: {
					for (let i = 0; i < list.length - 1; i++) {
						for (let j = i + 1; j < list.length; j++) {
							if (equalityCompare(list[i], list[j])) {
								return new ScriptValue("bool", [false]);
							}
						}
					}
					return new ScriptValue("bool", [true]);
				}
			}
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
			const cards = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player).filter(card => card.current());
			const discardActions = cards.map(card => new actions.Discard(
				ctx.player,
				card.current(),
				new ScriptValue("dueToReason", ["effect"]),
				new ScriptValue("card", [ctx.card.snapshot()])
			));
			const step = yield [...discardActions];
			return new ScriptValue("card", getSuccessfulActions(step, discardActions).map(action => action.card));
		},
		hasCardTarget,
		function*(astNode, ctx) {
			yield* this.getParameter(astNode, "card").evalFull(ctx);
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
			const drawAction = new actions.Draw(ctx.player, amount);
			const step = yield [drawAction];
			return new ScriptValue("card", getSuccessfulActions(step, [drawAction])[0]?.drawnCards ?? []);
		},
		alwaysHasTarget,
		undefined // TODO: Write evalFull
	),

	// Exiles the passed-in cards
	EXILE: new ScriptFunction(
		["card", "timeIndicator"],
		[null, new ast.ForeverNode()],
		"card",
		function*(astNode, ctx) {
			const cards = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player).filter(card => card.current());
			const until = (yield* this.getParameter(astNode, "timeIndicator").eval(ctx)).get(ctx.player)[0].getGeneratorList(ctx.game);
			const exileActions = cards.map(card => new actions.Exile(
				ctx.player,
				card.current(),
				until,
				new ScriptValue("dueToReason", ["effect"]),
				new ScriptValue("card", [ctx.card.snapshot()])
			));
			const step = yield [...exileActions];
			return new ScriptValue("card", getSuccessfulActions(step, exileActions).map(action => action.card));
		},
		hasCardTarget,
		function*(astNode, ctx) {
			yield* this.getParameter(astNode, "card").evalFull(ctx);
		}
	),

	// The executing player gains X life
	GAINLIFE: new ScriptFunction(
		["number"],
		[null],
		"number",
		function*(astNode, ctx) {
			const gainLifeAction = new actions.GainLife(ctx.player, (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player)[0]);
			const step = yield [gainLifeAction];
			return new ScriptValue("number", [getSuccessfulActions(step, [gainLifeAction])[0]?.amount ?? 0]);
		},
		alwaysHasTarget,
		function*(astNode, ctx) {
			yield* this.getParameter(astNode, "number").evalFull(ctx);
		}
	),

	// The executing player gains X mana
	GAINMANA: new ScriptFunction(
		["number"],
		[null],
		"number",
		function*(astNode, ctx) {
			const gainManaAction = new actions.GainMana(ctx.player, (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player)[0]);
			const step = yield [gainManaAction];
			return new ScriptValue("number", [getSuccessfulActions(step, [gainManaAction])[0]?.amount ?? 0]);
		},
		alwaysHasTarget,
		function*(astNode, ctx) {
			yield* this.getParameter(astNode, "number").evalFull(ctx);
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
		null,
		function*(astNode, ctx) {
			const target = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player)[0];
			yield [new actions.GiveAttack(
				ctx.player,
				target?.current(),
				new ScriptValue("dueToReason", ["effect"]),
				new ScriptValue("card", [ctx.card])
			)];
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
			const loseLifeAction = new actions.LoseLife(ctx.player, (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player)[0]);
			const step = yield [loseLifeAction];
			return new ScriptValue("number", [getSuccessfulActions(step, [loseLifeAction])[0]?.amount ?? 0]);
		},
		alwaysHasTarget,
		undefined // TODO: Write evalFull
	),

	// The executing player loses X mana
	LOSEMANA: new ScriptFunction(
		["number"],
		[null],
		"number",
		function*(astNode, ctx) {
			const loseManaAction = new actions.LoseMana(ctx.player, (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player)[0]);
			const step = yield [loseManaAction];
			return new ScriptValue("number", [getSuccessfulActions(step, [loseManaAction])[0]?.amount ?? 0]);
		},
		alwaysHasTarget,
		undefined // TODO: Write evalFull
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
				const zone = getZoneForCard(zoneValue.map(z => z instanceof DeckPosition? z.deck : z), card, ctx);
				// index of null means the player gets to choose
				let index = (zone instanceof zones.FieldZone || zone instanceof zones.DeckZone)? null : -1;
				const potentialDeckPosition = zoneValue.find(z => z instanceof DeckPosition && z.deck === zone);
				if (potentialDeckPosition) {
					index = potentialDeckPosition.isTop? -1 : 0;
				}
				moveActions.push(new actions.Move(
					ctx.player,
					card,
					zone,
					index,
					new ScriptValue("dueToReason", ["effect"]),
					new ScriptValue("card", [ctx.card])
				));
				zoneMoveCards.set(zone, (zoneMoveCards.get(zone) ?? []).concat(card));
				ast.clearImplicit("card");
			}

			for (const [zone, cards] of zoneMoveCards.entries()) {
				const freeSlots = zone.getFreeSpaceCount();
				if (freeSlots < cards.length) {
					if (freeSlots.length === 0) {
						return new ScriptValue("card", []);
					}
					const selectionRequest = new requests.ChooseCards(ctx.player, cards, [freeSlots], "cardEffectMove:" + ctx.ability.id);
					const response = yield [selectionRequest];
					const movedCards = selectionRequest.extractResponseValue(response);
					for (let i = moveActions.length - 1; i >= 0; i--) {
						if (moveActions[i].zone === zone && !movedCards.includes(moveActions[i].card)) {
							moveActions.splice(i, 1);
						}
					}
				}
			}

			const step = yield [...moveActions];
			return new ScriptValue("card", getSuccessfulActions(step, moveActions).map(action => action.card));
		},
		hasCardTarget,
		function*(astNode, ctx) {
			yield* this.getParameter(astNode, "card").evalFull(ctx);
		}
	),

	// The executing player needs to order these cards
	ORDER: new ScriptFunction(
		["card"],
		[null],
		"card",
		function*(astNode, ctx) {
			const toOrder = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player);
			const orderAction = new actions.OrderCards(
				ctx.player,
				toOrder,
				ctx.ability.id
			);

			yield [orderAction];
			return new ScriptValue("card", [...orderAction.ordered]);
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
		null,
		function*(astNode, ctx) {
			const cards = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player);
			const actionList = [];
			for (const card of cards) {
				const type = (yield* this.getParameter(astNode, "counter").eval(ctx)).get(ctx.player)[0];
				const amount = (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player)[0];
				actionList.push(new actions.ChangeCounters(
					ctx.player,
					card,
					type,
					amount,
					new ScriptValue("dueToReason", ["effect"]),
					new ScriptValue("card", [ctx.card])
				));
			}
			yield actionList;
		},
		hasCardTarget,
		undefined // TODO: Write evalFull
	),

	// Removes X counters of a given type from the given card(s)
	REMOVECOUNTERS: new ScriptFunction(
		["card", "counter", "amount"],
		[null, null, null],
		null,
		function*(astNode, ctx) {
			let cards = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player);
			const actionList = [];
			for (const card of cards) {
				const type = (yield* this.getParameter(astNode, "counter").eval(ctx)).get(ctx.player)[0];
				const amount = (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player)[0];
				actionList.push(new actions.ChangeCounters(
					ctx.player,
					card,
					type,
					-amount,
					new ScriptValue("dueToReason", ["effect"]),
					new ScriptValue("card", [ctx.card])
				));
			}
			yield actionList;
		},
		hasCardTarget,
		undefined // TODO: Write evalFull
	),

	// Makes the executing player reveal the given card
	REVEAL: new ScriptFunction(
		["card", "timeIndicator"],
		[null, null],
		"card",
		function*(astNode, ctx) {
			const untilParameter = this.getParameter(astNode, "timeIndicator");
			const until = untilParameter? (yield* untilParameter.eval(ctx)).get(ctx.player)[0].getGeneratorList(ctx.game) : false;
			const revealActions = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player).map(card => new actions.Reveal(ctx.player, card, until));
			const step = yield [...revealActions];
			return new ScriptValue("card", getSuccessfulActions(step, revealActions).map(action => action.card));
		},
		hasCardTarget,
		function*(astNode, ctx) {
			yield* this.getParameter(astNode, "card").evalFull(ctx);
		}
	),

	// rolls an n-sided dice
	ROLLDICE: new ScriptFunction(
		["number"],
		[6],
		"number",
		function*(astNode, ctx) {
			const sidedness = (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player);
			const action = new actions.RollDice(ctx.player, sidedness);
			yield [action];
			return new ScriptValue("number", action.result);
		},
		alwaysHasTarget,
		function*(astNode, ctx) {
			let largestSoFar = 0;
			for (const sidedness of this.getParameter(astNode, "number")) {
				for (let i = 1; i <= sidedness.get(ctx.player); i++) {
					if (i > largestSoFar) {
						yield i;
						largestSoFar = i;
					}
				}
			}
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
				return new ScriptValue("bool", [true]);
			}
			for (let i = 1; i < list.length; i++) {
				if (!equalityCompare(list[i], list[i-1])) {
					return new ScriptValue("bool", [false]);
				}
			}
			return new ScriptValue("bool", [true]);
		},
		alwaysHasTarget,
		undefined // TODO: Write evalFull
	),

	// Makes the executing player choose X cards from the given ones, either selecting at random or not.
	// The first bool parameter is a validator that takes any possible selection as implicit cards and returns whether
	// those conform to any additional constraints the card text imposes. (all having different names, for example)
	SELECT: new ScriptFunction(
		["number", "card", "bool", "bool"],
		[null, null, new ast.ValueNode([true], "bool"), new ast.ValueNode([false], "bool")],
		"card",
		function*(astNode, ctx) {
			let choiceAmounts = (yield* this.getParameter(astNode, "number").eval(ctx)).get(ctx.player);
			let eligibleCards = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player);
			const atRandom = (yield* this.getParameter(astNode, "bool", 1).eval(ctx)).getJsBool(ctx.player);

			// if we are not explicitly choosing from prior targets, already targeted cards need to be invalid choices.
			if (!eligibleCards.explicitTarget) {
				eligibleCards = eligibleCards.filter(card => !ctx.targets.card.includes(card));
			}

			// figure out how many cards the player should be asked to choose.
			// In the case of X+ cards, the actual maximum is clamped away from Infinity for practicality.
			const chooseAtLeast = astNode.asManyAsPossible?
			                      1 : choiceAmounts instanceof SomeOrMore?
			                      choiceAmounts.lowest : Math.min(...choiceAmounts);

			const chooseAtMost = choiceAmounts instanceof SomeOrMore?
			                     Math.max(eligibleCards.length, choiceAmounts.lowest) : // clamp down to not go to infinity
			                     Math.max(...choiceAmounts);

			choiceAmounts = [];
			for (let i = chooseAtLeast; i <= chooseAtMost; i++) {
				choiceAmounts.push(i);
			}

			// TODO: In the case of astNode.asManyAsPossible, we need to force the player to choose
			//       the largest combination of cards that matches the validator
			const validator = this.getParameter(astNode, "bool");
			const selectAction = new actions.SelectCards(
				ctx.player,
				eligibleCards,
				choiceAmounts,
				ctx.ability.id,
				cards => {
					ast.setImplicit(cards, "card");
					const result = validator.evalFull(ctx).next().value.getJsBool(ctx.player);
					ast.clearImplicit("card");
					return result;
				},
				atRandom,
				ctx.targets.card
			);

			yield [selectAction];
			const cardList = [...selectAction.selected];
			cardList.explicitTarget = true;
			return new ScriptValue("card", cardList);
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

					// if we are not explicitly choosing from prior targets, already targeted cards need to be invalid choices.
					if (!eligibleCards.explicitTarget) {
						eligibleCards = eligibleCards.filter(card => !ctx.targets.card.includes(card));
					}

					// figure out how many cards the player should be asked to choose.
					// In the case of X+ cards, the actual maximum is clamped away from Infinity for practicality.
					const chooseAtLeast = astNode.asManyAsPossible?
										1 : choiceAmounts instanceof SomeOrMore?
										choiceAmounts.lowest : Math.min(...choiceAmounts);

					const chooseAtMost = choiceAmounts instanceof SomeOrMore?
										Math.max(eligibleCards.length, choiceAmounts.lowest) : // clamp down to not go to infinity
										Math.max(...choiceAmounts);

					choiceAmounts = [];
					for (let i = chooseAtLeast; i <= chooseAtMost; i++) {
						choiceAmounts.push(i);
					}

					const validator = this.getParameter(astNode, "bool");
					for (const amount of choiceAmounts) {
						if (amount > eligibleCards.length) continue;
						const cardLists = nChooseK(eligibleCards.length, amount).map(list => list.map(i => eligibleCards[i]));
						for (const list of cardLists) {
							ast.setImplicit(list, "card");
							if(validator.evalFull(ctx).next().value.getJsBool(ctx.player)) {
								list.explicitTarget = true;
								yield new ScriptValue("card", list);
							}
							ast.clearImplicit("card");
						}
					}
				}
			}
		}
	),

	// Makes the executing player choose a type
	SELECTABILITY: new ScriptFunction(
		["abilityId"],
		[null],
		"abilityId",
		function*(astNode, ctx) {
			let eligibleAbilities = (yield* this.getParameter(astNode, "abilityId").eval(ctx)).get(ctx.player);

			// if we are not explicitly choosing from prior targets, already targeted abilities need to be invalid choices.
			if (!eligibleAbilities.explicitTarget) {
				eligibleAbilities = eligibleAbilities.filter(ability => !ctx.targets.abilityId.includes(ability));
			}

			const selectAction = new actions.SelectAbility(
				ctx.player,
				eligibleAbilities,
				ctx.ability.id,
				ctx.targets.abilityId
			);

			yield [selectAction];
			const abilities = [selectAction.selected];
			abilities.explicitTarget = true;
			return new ScriptValue("abilityId", abilities);
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
					const returnList = [ability];
					returnList.explicitTarget = true;
					yield new ScriptValue("abilityId", returnList);
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
			const selectAction = new actions.SelectDeckSide(
				ctx.player,
				(yield* this.getParameter(astNode, "player").eval(ctx)).get(ctx.player)[0],
				ctx.ability.id
			);

			yield [selectAction];
			return new ScriptValue("zone", [selectAction.selected]);
		},
		alwaysHasTarget,
		function*(astNode, ctx) {
			for (const player of this.getParameter(astNode, "player").evalFull(ctx)) {
				const zone = player.get(ctx.player)[0].deckZone;
				yield new ScriptValue("zone", [new DeckPosition(zone, true)]);
				yield new ScriptValue("zone", [new DeckPosition(zone, false)]);
			}
		}
	),

	// Makes the executing player choose a player
	SELECTPLAYER: new ScriptFunction(
		[],
		[],
		"player",
		function*(astNode, ctx) {
			// TODO: properly excluding players that were targeted prior
			const selectAction = new actions.SelectPlayer(
				ctx.player,
				ctx.ability.id,
				ctx.targets.player
			);

			yield [selectAction];
			const players = [selectAction.selected];
			players.explicitTarget = true;
			return new ScriptValue("player", players);
		},
		alwaysHasTarget,
		function*(astNode, ctx) {
			for (const player of ctx.game.players) {
				const returnList = [player];
				returnList.explicitTarget = true;
				yield new ScriptValue("player", returnList);
			}
		}
	),

	// Makes the executing player choose a type
	SELECTTYPE: new ScriptFunction(
		["type"],
		[null],
		"type",
		function*(astNode, ctx) {
			const selectAction = new actions.SelectType(
				ctx.player,
				(yield* this.getParameter(astNode, "type").eval(ctx)).get(ctx.player),
				ctx.ability.id
			);

			yield [selectAction];
			return new ScriptValue("type", [selectAction.selected]);
		},
		function(astNode, ctx) {
			// Use the full eval to see if there is any valid choices for the player.
			return !this.runFull(astNode, ctx).next().done;
		},
		function*(astNode, ctx) {
			const alreadyYielded = [];
			for (const types of this.getParameter(astNode, "type").evalFull(ctx)) {
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
		null,
		function*(astNode, ctx) {
			yield [new actions.SetAttackTarget(
				ctx.player,
				(yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player)[0] ?? null,
				new ScriptValue("dueToReason", ["effect"]),
				new ScriptValue("card", [ctx.card])
			)];
		},
		hasCardTarget,
		function*(astNode, ctx) {
			for (const cardVal of this.getParameter(astNode, "card").evalFull(ctx)) {
				yield new ScriptValue("card", cardVal.get(ctx.player));
			}
		}
	),

	// The executing player shuffles their deck without the given cards
	SHUFFLE: new ScriptFunction(
		["card"],
		[new ast.ValueNode([], "card")],
		null,
		function*(astNode, ctx) {
			yield [new actions.Shuffle(ctx.player)];
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
	// If a modifier is given, the bool refers to whether or not it is mandatory, otherwise it indicates whether or not the mana cost needs to be paid at all.
	SUMMON: new ScriptFunction(
		["card", "zone", "modifier", "bool"],
		[null, new ast.ZoneNode("unitZone", new ast.PlayerNode("you")), null, new ast.ValueNode([true], "bool")],
		"card",
		function*(astNode, ctx) {
			let cards = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player);
			const zone = (yield* this.getParameter(astNode, "zone").eval(ctx)).get(ctx.player).find(zone => zone.type === "unit");
			const modifier = this.getParameter(astNode, "modifier")? (yield* this.getParameter(astNode, "modifier").eval(ctx)).get(ctx.player) : null;
			const boolParam = (yield* this.getParameter(astNode, "bool").eval(ctx)).getJsBool(ctx.player);

			// check for unsummonable cards
			for (let i = cards.length - 1; i >= 0; i--) {
				if (cards[i].current() === null) {
					cards.splice(i, 1);
				}
			}
			// make player choose which cards to summon if there is not enough space
			const freeZoneSlots = zone.getFreeSpaceCount();
			if (freeZoneSlots < cards.length) {
				// Not being able to summon enough units must interrupt the block
				if (freeZoneSlots === 0) yield [];
				if (!astNode.asManyAsPossible) yield [];

				const selectionRequest = new requests.ChooseCards(ctx.player, cards, [freeZoneSlots], "cardEffectSummon:" + ctx.ability.id);
				const response = yield [selectionRequest];
				cards = selectionRequest.extractResponseValues(response);
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
							const doesMatch = (yield* modifier.modifications[0].toModify.eval(modifier.ctx)).getJsBool();
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
								//const request = new ApplyActionModificationAbility(ability.card.currentOwner(), ability, target);
								//const response = yield [request];
								//response.value = request.extractResponseValues(response);
								//if (!response.value) continue;
							}

							// apply the modification, then stop iterating
							actions.replaceActionInList(costs, action, replacements);
							break;
						}
					}
				}
			}

			const costStep = yield costs;
			const summons = [];
			for (let i = 0; i < costStep.costCompletions.length; i++) {
				if (costStep.costCompletions[i]) {
					summons.push(new actions.Summon(
						ctx.player,
						placeActions[i],
						new ScriptValue("dueToReason", ["effect"]),
						new ScriptValue("card", [ctx.card])
					));
				}
			}
			const summonStep = yield [...summons];
			return new ScriptValue("card", getSuccessfulActions(summonStep, summons).map(action => action.card));
		},
		hasCardTarget,
		function*(astNode, ctx) {
			yield* this.getParameter(astNode, "card").evalFull(ctx);
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
			if (amounts instanceof SomeOrMore) {
				amount = Infinity;
			} else if (amounts.length === 1) {
				amount = amounts[0];
			} else {
				const selectionRequest = new requests.SelectTokenAmount(ctx.player, amounts);
				const response = yield [selectionRequest];
				amount = selectionRequest.extractResponseValues(response);
			}

			const freeSpaces = zone.getFreeSpaceCount()
			if (amount > freeSpaces && !astNode.asManyAsPossible) {
				// Not being able to summon enough tokens must interrupt the block
				yield [];
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
			const costStep = yield costs;
			const summons = [];
			for (let i = 0; i < costStep.costCompletions.length; i++) {
				if (costStep.costCompletions[i]) {
					summons.push(new actions.Summon(
						ctx.player,
						placeActions[i],
						new ScriptValue("dueToReason", ["effect"]),
						new ScriptValue("card", [ctx.card])
					));
				}
			}
			const summonStep = yield [...summons];
			return new ScriptValue("card", getSuccessfulActions(summonStep, summons).map(action => action.card));
		},
		alwaysHasTarget,
		undefined // TODO: Write evalFull
	),

	// Swaps two cards with eachother
	SWAP: new ScriptFunction(
		["card", "card", "bool"],
		[null, null, new ast.ValueNode([false], "bool")],
		null,
		function*(astNode, ctx) {
			let cardA = (yield* this.getParameter(astNode, "card", 0).eval(ctx)).get(ctx.player)[0];
			let cardB = (yield* this.getParameter(astNode, "card", 1).eval(ctx)).get(ctx.player)[0];
			let transferEquipments = (yield* this.getParameter(astNode, "bool").eval(ctx)).getJsBool(ctx.player);

			yield [new actions.Swap(
				ctx.player,
				cardA,
				cardB,
				transferEquipments,
				new ScriptValue("dueToReason", ["effect"]),
				new ScriptValue("card", [ctx.card])
			)];
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

	// The player looks at a card.
	VIEW: new ScriptFunction(
		["card"],
		[null],
		"card",
		function*(astNode, ctx) {
			const cards = (yield* this.getParameter(astNode, "card").eval(ctx)).get(ctx.player);
			const viewActions = cards.filter(card => card.current()).map(card => new actions.View(ctx.player, card.current()));
			const step = yield viewActions;
			return new ScriptValue("card", getSuccessfulActions(step, viewActions).map(action => action.card));
		},
		hasCardTarget,
		function*(astNode, ctx) {
			yield* this.getParameter(astNode, "card").evalFull(ctx);
		}
	),

	// The player wins the game
	WINGAME: new ScriptFunction(
		[],
		[],
		null,
		function*(astNode, ctx) {
			yield [new actions.WinGame(ctx.player, ctx.ability.id)];
		},
		alwaysHasTarget,
		undefined // TODO: Write evalFull
	)
}
};