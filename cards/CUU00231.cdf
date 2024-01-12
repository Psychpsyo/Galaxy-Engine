id: CUU00231
cardType: unit
name: CUU00231
level: 3
types: Dark, Warrior, Ghost, Figure
attack: 300
defense: 200

o: optional
turnLimit: 3
condition: thisCard.zone = field
cost:
EXILE(SELECT(1, [from you.discard where cardType = unit]));
exec:
APPLY(thisCard, {attack += 100}, endOfTurn);