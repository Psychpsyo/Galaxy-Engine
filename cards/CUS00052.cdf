id: CUS00052
cardType: enchantSpell
name: CUS00052
level: 2
types: Ice

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {attack = 0, defense = 0 if types = Water}

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {types += Ice}