id: CUU00212
cardType: unit
name: CUU00212
level: 2
types: Water
attack: 100
defense: 200

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
LOSELIFE(200);
exec:
APPLY([from you.field where cardType = unit & types = Water & COUNT(types) = 1], {attack += 200}, endOfTurn);