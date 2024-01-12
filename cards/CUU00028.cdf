id: CUU00028
cardType: unit
name: CUU00028
level: 2
types: Fire, Psychic
attack: 200
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field & currentTurn.summoned != thisCard
DISCARD?(opponent.DECKTOP?(COUNT([from you.field where types = Fire])));