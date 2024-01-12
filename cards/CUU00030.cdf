id: CUU00030
cardType: unit
name: CUU00030
level: 4
types: Earth, Light, Warrior
attack: 200
defense: 300

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {defense += COUNT([from field where self != thisCard & types = Earth]) * 100}