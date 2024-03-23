id: CUU00288
cardType: unit
name: CUU00288
level: 1
types: Water, Ghost
attack: 100
defense: 0
deckLimit: 4

o: fast
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand where types = Water]));
exec:
APPLY(SELECT(1, [from field where types = Water & cardType = unit]), {level += 2}, endOfTurn);

o: trigger
mandatory: no
condition: thisCard.zone = field
after: COUNT([from summoned(to: you.field) where self != thisCard & name = CUU00288]) > 0
afterPrecondition: thisCard.zone = field
DISCARD(SELECT(1, [from you.deck where types = Water & types = Ghost]));