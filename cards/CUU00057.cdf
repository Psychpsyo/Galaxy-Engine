id: CUU00057
cardType: unit
name: CUU00057
level: 2
types: Wind, Earth, Machine
attack: 0
defense: 200

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.field]));
exec:
opponent.DAMAGE(100);

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.field]));
exec:
DESTROY(SELECT(1, [from field where cardType = [spell, item]]));