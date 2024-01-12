id: CUU00199
cardType: unit
name: CUU00199
level: 2
types: Dark, Ghost, Figure, Curse
attack: 200
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
LOSELIFE(200);
exec:
APPLY(thisCard, {attackRights = 2}, endOfTurn);