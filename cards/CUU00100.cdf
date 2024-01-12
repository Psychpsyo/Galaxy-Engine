id: CUU00100
cardType: unit
name: CUU00100
level: 9
types: Water, Ghost
attack: 500
defense: 500

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {attack, defense += COUNT([from you.discard where types = thisCard.types]) * 50}