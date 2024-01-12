id: CUS00065
cardType: enchantSpell
name: CUS00065
level: 2
types: Spirit
equipableTo: types = Spirit & zone = you.unitZone

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {attack, defense += 100, level += 2}