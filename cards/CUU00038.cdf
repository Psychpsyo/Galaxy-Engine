id: CUU00038
cardType: unit
name: CUU00038
level: 5
types: Water, Dark, Fish
attack: 500
defense: 400

o: static
applyTo: thisCard
condition: thisCard.zone = field & currentTurn.summoned = thisCard
modifier: {unaffectedBy self != thisCard}