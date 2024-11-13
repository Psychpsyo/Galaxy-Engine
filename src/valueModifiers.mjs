// This file holds definitions for the CardValues class and modifiers for the card's modifier stacks.
import * as ast from "./cdfScriptInterpreter/astNodes.mjs";
import * as abilities from "./abilities.mjs";
import {BaseCard} from "./card.mjs";
import {makeAbility} from "./cdfScriptInterpreter/interpreter.mjs";

const unitSpecificValues = ["attack", "defense", "attackRights", "canAttack", "canCounterattack"];

export function recalculateModifiedValuesFor(object) {
	// for cards, all abilities need to be un-cancelled as a baseline
	if (object instanceof BaseCard) {
		for (const ability of object.values.initial.abilities) {
			ability.isCancelled = false;
		}
	}

	// handle values being unaffected by cards
	object.values.unaffectedBy = [];
	for (const modifier of object.values.modifierStack) {
		modifier.modify(object, false, true);
	}

	// handle base value changes
	object.values.base = object.values.initial.clone();
	for (const modifier of object.values.modifierStack) {
		object.values.base = modifier.modify(object, true, false);
	}

	// non-unit cards need to loose unit-specific base values
	if (object instanceof BaseCard) {
		if (!object.values.base.cardTypes.includes("unit")) {
			for (const value of unitSpecificValues) {
				object.values.base[value] = null;
			}
		}
	}

	// handle main value changes
	object.values.current = object.values.base.clone();
	for (const modifier of object.values.modifierStack) {
		object.values.current = modifier.modify(object, false, false);
	}

	// non-unit cards also need to loose unit-specific regular values
	if (object instanceof BaseCard) {
		if (!object.values.current.cardTypes.includes("unit")) {
			for (const value of unitSpecificValues) {
				object.values.current[value] = null;
			}
		}
	}
}

class Unaffection {
	constructor(by, modifier) {
		this.by = by; // what that value is unaffected by
		this.modifier = modifier; // the modifier that this came from
	}
}
export class ValueUnaffection extends Unaffection {
	constructor(value, by, modifier) {
		super(by, modifier);
		this.value = value; // the value that is unaffected
	}
}
export class CompleteUnaffection extends Unaffection {
	constructor(by, sourceCard, sourceAbility) {
		super(by, sourceCard, sourceAbility);
	}
}

export class Modifier {
	#wasStaticCancelled = false;
	constructor(modifications, ctx) {
		this.modifications = modifications;
		this.ctx = ctx;
	}

	modify(object, toBaseValues, toUnaffections) {
		let values = toBaseValues? object.values.base : object.values.current;
		// re-baking static abilities once they un-cancel
		if (this.ctx.ability instanceof abilities.StaticAbility) {
			if (this.ctx.ability.isCancelled) {
				this.#wasStaticCancelled = true;
				return values;
			} else if (this.#wasStaticCancelled) {
				// static ability became un-cancelled => re-bake modifications
				this.#wasStaticCancelled = false;
				this.modifications = this.#bakeModificationsStatic(object);
			}
		}
		// actually applying modifications
		for (let modification of this.modifications) {
			if (!(modification instanceof ValueModification || modification instanceof CompletelyUnaffectedModification)) {
				continue;
			}
			let worksOnObject = true;
			// only static abilities are influenced by unaffections/cancelling when already on a card
			if (this.ctx.ability instanceof abilities.StaticAbility) {
				if (!modification.canApplyTo(object, this.ctx)) {
					worksOnObject = false;
				}
			}
			// set implicit card / player
			ast.setImplicit([object], object.cdfScriptType);
			if (worksOnObject &&
				(modification instanceof ValueUnaffectedModification || modification instanceof AbilityCancelModification || modification instanceof CompletelyUnaffectedModification) === toUnaffections &&
				(modification.condition === null || modification.condition.evalFull(this.ctx).next().value.getJsBool(this.ctx.player))
			) {
				if (modification instanceof ValueUnaffectedModification) {
					object.values.unaffectedBy.push(new ValueUnaffection(modification.value, modification.unaffectedBy, this));
				} else if (modification instanceof CompletelyUnaffectedModification) {
					object.values.unaffectedBy.push(new CompleteUnaffection(modification.unaffectedBy, this));
				} else {
					values = modification.modify(values, this.ctx, toBaseValues);
				}
			}
			// clear implicit card / player
			ast.clearImplicit(object.cdfScriptType);
		}
		return values;
	}

	// Removes all unit-specific modifications from this modifier and returns true if that empties the modifier entirely.
	// This is for cleaning up the modifier stack on cards that ceased being units.
	removeUnitSpecificModifications() {
		for (let i = this.modifications.length - 1; i >= 0; i--) {
			if (this.modifications[i].isUnitSpecific()) {
				this.modifications.splice(i, 1);
			}
		}
		return this.modifications.length === 0;
	}

	// converts the modifier to one that won't change when the underlying expressions that derive its values change.
	bake(target) {
		ast.setImplicit([target], target.cdfScriptType);
		const bakedModifications = this.modifications.map(modification => modification.bake(this.ctx, target)).filter(modification => modification !== null);
		ast.clearImplicit(target.cdfScriptType);
		return new Modifier(bakedModifications, this.ctx);
	}

	bakeStatic(target) {
		return new Modifier(this.#bakeModificationsStatic(target), this.ctx);
	}

	#bakeModificationsStatic(target) {
		ast.setImplicit([target], target.cdfScriptType);
		const bakedModifications = this.modifications.map(modification => modification.bakeStatic(this.ctx, target)).filter(modification => modification !== null);
		ast.clearImplicit(target.cdfScriptType);
		return bakedModifications;
	}
}

export class Modification {
	constructor(condition) {
		this.condition = condition;
	}

	bake(ctx, target) {
		return this;
	}

	// bakes a modifier for a static ability. (i.e. does not pre-compute expressions, only creates things like ability objects from their IDs)
	bakeStatic(ctx, target) {
		return this;
	}

	isUnitSpecific() {
		return false;
	}

	canApplyTo(target, ctx) {
		ast.setImplicit([ctx.card], "card");
		for (const unaffection of target.values.unaffectedBy) {
			if (unaffection instanceof CompleteUnaffection &&
			    unaffection.by.evalFull(unaffection.modifier.ctx).next().value.getJsBool(unaffection.modifier.ctx.player)
			) {
				ast.clearImplicit("card");
				return false;
			}
		}
		ast.clearImplicit("card");

		return true;
	}
	canFullyApplyTo(target, ctx) {
		return this.canApplyTo(target, ctx);
	}
}

export class ValueModification extends Modification {
	constructor(value, toBase, condition) {
		super(condition);
		this.value = value;
		this.toBase = toBase;
	}
	modify(values, ctx, toBaseValues) {
		return values;
	}

	isUnitSpecific() {
		return unitSpecificValues.includes(this.value);
	}

	canApplyTo(target, ctx) {
		if (target instanceof BaseCard) {
			// certain stat-changes can only be applied to units
			if (this.isUnitSpecific() && !target.values.current.cardTypes.includes("unit")) {
				return false;
			}
		}
		// objects that are unaffected can't have modifications applied
		ast.setImplicit([ctx.card], "card");
		for (const unaffection of target.values.unaffectedBy) {
			if ((unaffection instanceof CompleteUnaffection || unaffection.value === this.value) &&
			     unaffection.by.evalFull(unaffection.modifier.ctx).next().value.getJsBool(unaffection.modifier.ctx.player)
			) {
				ast.clearImplicit("card");
				return false;
			}
		}
		ast.clearImplicit("card");
		return true;
	}
}

export class ValueUnaffectedModification extends ValueModification {
	constructor(value, unaffectedBy, toBase, condition) {
		super(value, toBase, condition);
		this.unaffectedBy = unaffectedBy;
	}

	// specifically don't check value unaffections since making a value unaffected is not affecting the value
	canApplyTo(target, ctx) {
		if (target instanceof BaseCard) {
			// certain stats only exist for units
			if (this.isUnitSpecific() && !target.values.current.cardTypes.includes("unit")) {
				return false;
			}
		}
		return super.canApplyTo(target, ctx);
	}
}

export class ValueSetModification extends ValueModification {
	constructor(value, newValue, toBase, condition) {
		super(value, toBase, condition);
		this.newValue = newValue;
	}

	modify(values, ctx, toBaseValues) {
		if (toBaseValues === this.toBase) {
			values[this.value] = this.newValue.evalFull(ctx).next().value.getJsVal(ctx.player);
		}
		return values;
	}

	bake(ctx, target) {
		let valueArray = this.newValue.evalFull(ctx).next().value;
		let type = valueArray.type;
		valueArray = valueArray.get(ctx.player);
		if (valueArray.length == 0) {
			return null;
		}
		// construct ability instances now
		if (this.value === "abilities") {
			valueArray = valueArray.map(val => makeAbility(type === "abilityId"? val : val.id, ctx.game));
			for (const ability of valueArray) {
				ability.card = target;
			}
			type = "ability";
		}
		return new ValueSetModification(this.value, new ast.ValueNode(valueArray, type), this.toBase, this.condition);
	}
}

export class ValueAppendModification extends ValueModification {
	constructor(value, newValues, toBase, condition) {
		super(value, toBase, condition);
		this.newValues = newValues;
	}

	modify(values, ctx, toBaseValues) {
		if (toBaseValues === this.toBase) {
			const newValues = this.newValues.evalFull(ctx).next().value.get(ctx.player);
			for (const newValue of newValues) {
				// abilities are always put onto cards in an un-cancelled state
				if (this.value === "abilities") {
					newValue.isCancelled = false;
				}
				if (!values[this.value].includes(newValue)) {
					values[this.value].push(newValue);
				}
			}
		}
		return values;
	}

	bake(ctx, target) {
		let valueArray = this.newValues.evalFull(ctx).next().value;
		let type = valueArray.type;
		valueArray = valueArray.get(ctx.player);
		if (valueArray.length == 0) {
			return null;
		}
		// construct ability instances now
		if (this.value === "abilities") {
			valueArray = valueArray.map(val => makeAbility(type === "abilityId"? val : val.id, ctx.game));
			for (const ability of valueArray) {
				ability.card = target;
			}
			type = "ability";
		}
		return new ValueAppendModification(this.value, new ast.ValueNode(valueArray, type), this.toBase, this.condition);
	}

	bakeStatic(ctx, target) {
		if (this.value !== "abilities") return this;

		let valueArray = this.newValues.evalFull(ctx).next().value;
		const type = valueArray.type;
		valueArray = valueArray.get(ctx.player).map(val => makeAbility(this.newValues.returnType === "abilityId"? val : val.id, ctx.game));
		for (const ability of valueArray) {
			ability.card = target;
		}
		return new ValueAppendModification(this.value, new ast.ValueNode(valueArray, "ability"), this.toBase, this.condition);
	}
}

export class NumericChangeModification extends ValueModification {
	constructor(value, amount, toBase, condition) {
		super(value, toBase, condition);
		this.amount = amount;
	}

	modify(values, ctx, toBaseValues) {
		if (toBaseValues === this.toBase) {
			let amount = this.amount.evalFull(ctx).next().value.get(ctx.player)[0];
			values[this.value] = Math.max(0, values[this.value] + amount);
		}
		return values;
	}

	bake(ctx, target) {
		const valueArray = this.amount.evalFull(ctx).next().value.get(ctx.player);
		if (valueArray.length == 0) {
			return null;
		}
		return new NumericChangeModification(this.value, new ast.ValueNode(valueArray, this.amount.returnType), this.toBase, this.condition);
	}
	canFullyApplyTo(target, ctx) {
		if (!this.canApplyTo(target, ctx)) return false;
		if (target.values.current[this.value] + this.amount.evalFull(ctx).next().value.get(ctx.player)[0] < 0) return false;
		return true;
	}
}

export class NumericDivideModification extends ValueModification {
	constructor(value, byAmount, toBase, condition) {
		super(value, toBase, condition);
		this.byAmount = byAmount;
	}

	modify(values, ctx, toBaseValues) {
		if (toBaseValues === this.toBase) {
			const byAmount = this.byAmount.evalFull(ctx).next().value.get(ctx.player)[0];
			values[this.value] = Math.ceil(values[this.value] / byAmount);
		}
		return values;
	}

	bake(ctx, target) {
		const valueArray = this.byAmount.evalFull(ctx).next().value.get(ctx.player);
		if (valueArray.length == 0) {
			return null;
		}
		return new NumericDivideModification(this.value, new ast.ValueNode(valueArray, this.byAmount.returnType), this.toBase, this.condition);
	}
}

export class ValueSwapModification extends ValueModification {
	constructor(value, other, toBase, condition) {
		super(value, toBase, condition);
		this.other = other;
	}

	modify(values, ctx, toBaseValues) {
		if (toBaseValues === this.toBase) {
			let temp = values[this.value];
			values[this.value] = values[this.other];
			values[this.other] = temp;
		}
		return values;
	}
}

export class AbilityCancelModification extends ValueModification {
	constructor(value, toBase, condition) {
		super(value, toBase, condition);
		this.abilities = abilities;
	}

	modify(values, ctx, toBaseValues) {
		if (toBaseValues === this.toBase) {
			for (const ability of values.abilities) {
				if (ability.cancellable) {
					ability.isCancelled = true;
				}
			}
		}
		return values;
	}

	bake(ctx, target) {
		return this;
	}

	canApplyTo(target, ctx) {
		let hasValidAbility = false;
		for (const ability of target.values.current.abilities) {
			if (ability.cancellable && !ability.isCancelled) {
				hasValidAbility = true;
				break;
			}
		}
		return hasValidAbility && super.canApplyTo(target, ctx);
	}
	canFullyApplyTo(target, ctx) {
		for (const ability of target.values.current.abilities) {
			if (!ability.cancellable || ability.isCancelled) {
				return false;
			}
		}
		return super.canFullyApplyTo(target, ctx);
	}
}

// This is a special modification for the yourLifeDamage/opponentLifeDamage values on fights.
// It also never affects base values and is only used in static abilities, therefore baking is not needed.
export class DamageOverrideSetModification extends ValueModification {
	constructor(value, newValue, condition) {
		super(value, false, condition);
		this.newValue = newValue;
	}

	modify(values, ctx, toBaseValues) {
		if (toBaseValues) return values;

		const affectedPlayer = this.value === "yourLifeDamage"? ctx.player : ctx.player.next();
		values.lifeDamageOverrides.set(affectedPlayer, this.newValue.evalFull(ctx).next().value.get(ctx.player));

		return values;
	}
}

export class CompletelyUnaffectedModification extends Modification {
	constructor(unaffectedBy, condition) {
		super(condition);
		this.unaffectedBy = unaffectedBy;
	}
}

// ActionModifications are mandatory or optional modifications that apply to actions which are about to happen.
// They are intentionally very empty since the actual functionality is inside of the Step class
export class ActionModification extends Modification {
	constructor(toModify, condition) {
		super(condition);
		this.toModify = toModify;
	}
}
export class ActionReplaceModification extends ActionModification {
	constructor(toReplace, replacement, condition) {
		super(toReplace, condition);
		this.replacement = replacement;
	}
}
export class ActionCancelModification extends ActionModification {
	constructor(toCancel, condition) {
		super(toCancel, condition);
	}
}

// A ProhibitModification declares certain actions as impossible. (for effects that say things like "this card cannot be exiled")
export class ProhibitModification extends Modification {
	constructor(toProhibit, condition) {
		super(condition);
		this.toProhibit = toProhibit;
	}
}