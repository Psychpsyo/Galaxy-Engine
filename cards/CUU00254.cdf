id: CUU00254
cardType: unit
name: CUU00254
level: 3
types: Water, Dragon
attack: 300
defense: 50

o: trigger
gameLimit: 1
mandatory: no
after: destroyed(from: field) = thisCard
cost:
DISCARD(SELECT(1, [from you.hand where types = thisCard.types]));
exec:
MOVE([from discard where self = thisCard], field);