id: CUS00061
cardType: enchantSpell
name: CUS00061
level: 2
types:

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field & currentBlock = fightBlock
modifier: {attack >< defense}
