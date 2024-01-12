id: CUS00168
cardType: enchantSpell
name: CUS00168
level: 1
types: Wind
equipableTo: owner = you

o: static
applyTo: [from opponent.field]
condition: thisCard.zone = field & currentBlock = fightBlock & attackers = thisCard.equippedUnit
modifier: {canCounterattack = no}