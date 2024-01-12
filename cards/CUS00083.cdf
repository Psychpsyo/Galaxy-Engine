id: CUS00083
cardType: continuousSpell
name: CUS00083
level: 1
types: Earth, Wind, Illusion

o: fast
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(2, [from you.hand where types = Earth]));
exec:
EXILE(SELECT(1, [from you.field where level < 5 & cardType = unit]), endOfTurn);