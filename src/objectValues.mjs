
// not a superclass for Card/Player/Fight Values but a container.
export class ObjectValues {
	constructor(initial) {
		this.initial = initial;
		this.base = initial;
		this.current = initial;

		this.modifierStack = [];
		this.unaffectedBy = [];
		this.modifiedByStaticAbility = false; // whether or not there is any static ability modifying this object
	}

	clone() {
		const newValues = new ObjectValues(this.initial.clone());
		newValues.base = this.base.clone();
		newValues.current = this.current.clone();
		newValues.modifierStack = [...this.modifierStack];
		newValues.unaffectedBy = [...this.unaffectedBy];
		newValues.modifiedByStaticAbility = this.modifiedByStaticAbility;

		// cloning abilities if this is for a card
		if (this.initial instanceof CardValues) {
			const abilities = this.getAllAbilities();
			const abilitySnapshots = abilities.map(ability => ability.snapshot());
			newValues.initial.abilities = newValues.initial.abilities.map(ability => abilitySnapshots[abilities.indexOf(ability)]);
			newValues.base.abilities = newValues.base.abilities.map(ability => abilitySnapshots[abilities.indexOf(ability)]);
			newValues.current.abilities = newValues.current.abilities.map(ability => abilitySnapshots[abilities.indexOf(ability)]);
		}
		return newValues;
	}

	// returns an array of all (initial, base and current) abilities without duplicates
	getAllAbilities() {
		const abilities = [...this.initial.abilities];
		for (const ability of this.base.abilities.concat(this.current.abilities)) {
			if (!abilities.includes(ability)) {
				abilities.push(ability);
			}
		}
		return abilities;
	}
}

export class CardValues {
	constructor(cardTypes, names, level, types, attack, defense, abilities, attackRights, canAttack, canCounterattack) {
		this.cardTypes = cardTypes;
		this.names = names;
		this.level = level;
		this.types = types;
		this.attack = attack;
		this.defense = defense;
		this.abilities = abilities;
		this.attackRights = attackRights;
		this.canAttack = canAttack;
		this.canCounterattack = canCounterattack;
	}

	// Clones these values WITHOUT cloning contained abilities by design.
	// This is because initial, base and current values are cloned together in ObjectValues.
	clone() {
		return new CardValues(
			[...this.cardTypes],
			[...this.names],
			this.level,
			[...this.types],
			this.attack,
			this.defense,
			[...this.abilities],
			this.attackRights,
			this.canAttack,
			this.canCounterattack
		);
	}

	// returns a list of all properties that are different between this and other
	compareTo(other) {
		const differences = [];
		for (const property of ["level", "attack", "defense", "attackRights"]) {
			if (this[property] != other[property]) {
				differences.push(property);
			}
		}

		for (const property of ["cardTypes", "names", "types", "abilities"]) {
			if (this[property].length != other[property].length) {
				differences.push(property);
			} else {
				for (let i = 0; i < this[property].length; i++) {
					if (
						(property !== "abilities" && this[property][i] !== other[property][i]) ||
						(property === "abilities" && (this[property][i].isCancelled !== other[property][i].isCancelled || this[property][i].id !== other[property][i].id))) {
						differences.push(property);
						break;
					}
				}
			}
		}
		return differences;
	}
}

export class PlayerValues {
	constructor(manaGainAmount = 5, standardDrawAmount = 1, needsToPayForPartner = true, canEnterBattlePhase = true) {
		this.manaGainAmount = manaGainAmount;
		this.standardDrawAmount = standardDrawAmount;
		this.needsToPayForPartner = needsToPayForPartner;
		this.canEnterBattlePhase = canEnterBattlePhase;
	}

	clone() {
		return new PlayerValues(
			this.manaGainAmount,
			this.standardDrawAmount,
			this.needsToPayForPartner,
			this.canEnterBattlePhase
		);
	}

	// returns a list of all properties that are different between this and other
	compareTo(other) {
		const differences = [];
		for (const property of ["manaGainAmount", "standardDrawAmount", "needsToPayForPartner", "canEnterBattlePhase"]) {
			if (this[property] != other[property]) {
				differences.push(property);
			}
		}
		return differences;
	}
};

export class FightValues {
	constructor(dealDamageTo, counterattackFirst = false, lifeDamageOverrides = new Map(), useBaseValuesFor = []) {
		this.dealDamageTo = dealDamageTo; // list of players that damage can be dealt to by this fight
		this.counterattackFirst = counterattackFirst; // if true, the counterattack happens before the attack for this fight
		this.lifeDamageOverrides = lifeDamageOverrides; // maps player objects to how much damage will be dealt to them (or doesnt, in case it isn't being overriden)
		this.useBaseValuesFor = useBaseValuesFor; // a list of cards for which the fight process should use base attack and defense instead of the regular ones
	}

	clone() {
		return new FightValues(
			[...this.dealDamageTo],
			this.counterattackFirst,
			new Map(this.lifeDamageOverrides),
			[...this.useBaseValuesFor]
		);
	}

	// returns a list of all properties that are different between this and other
	compareTo(other) {
		const differences = [];
		for (const property of ["counterattackFirst"]) {
			if (this[property] != other[property]) {
				differences.push(property);
			}
		}
		for (const property of ["dealDamageTo", "useBaseValuesFor"]) {
			if (this[property].length != other[property].length) {
				differences.push(property);
			} else {
				for (let i = 0; i < this[property].length; i++) {
					if (this[property][i] !== other[property][i]) {
						differences.push(property);
						break;
					}
				}
			}
		}
		if (other.lifeDamageOverrides.size !== this.lifeDamageOverrides.size) {
			differences.push("lifeDamageOverrides");
		} else {
			// TODO: also check all the individual overrides.
		}

		return differences;
	}
};