id: CUU00056
cardType: unit
name: CUU00056
level: 2
types: Wind, Demon
attack: 200
defense: 100

o: static
applyTo: [from field where types = Machine & cardType = unit]
condition: thisCard.zone = field
modifier: {canAttack = no}