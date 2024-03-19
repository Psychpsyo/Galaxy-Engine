id: CUU00058
cardType: unit
name: CUU00058
level: 3
types: Dark, Warrior
attack: 600
defense: 0

o: static
applyTo: [from fights where participants = thisCard]
condition: thisCard.zone = field
modifier: {opponentLifeDamage = 0}