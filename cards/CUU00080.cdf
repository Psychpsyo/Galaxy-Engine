id: CUU00080
cardType: unit
name: CUU00080
level: 4
types: Earth, Wind, Fire, Bug
attack: 500
defense: 200

o: optional
condition: thisCard.zone = field
cost:
DISCARD(SELECT(2, [from you.hand where types = Earth]));
exec:
EXILE(thisCard, you.nextTurn.battlePhase);