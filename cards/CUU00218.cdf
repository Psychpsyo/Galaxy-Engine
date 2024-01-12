id: CUU00218
cardType: unit
name: CUU00218
level: 2
types: Light, Earth, Plant, Mage
attack: 100
defense: 200

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand where cardType = spell]));
exec:
APPLY(thisCard, {attack += COUNT([from field where self != thisCard & types = Plant]) * 100}, endOfTurn);