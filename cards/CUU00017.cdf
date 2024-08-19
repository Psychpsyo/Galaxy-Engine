id: CUU00017
cardType: unit
name: CUU00017
level: 7
types: Earth, Machine, Figure
attack: 700
defense: 700

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {unaffectedBy self != thisCard & types = Landmine}