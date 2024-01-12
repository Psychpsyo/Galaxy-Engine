id: CUU00129
cardType: unit
name: CUU00129
level: 3
types: Fire, Ghost
attack: 100
defense: 0

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {attack, defense += COUNT([from you.discard where types = Fire]) * 50}