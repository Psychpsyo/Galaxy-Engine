id: CUU00070
cardType: unit
name: CUU00070
level: 2
types: Dark, Warrior, Curse
attack: 200
defense: 100

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {unaffectedBy self != thisCard}