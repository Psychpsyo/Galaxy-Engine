id: CUU00263
cardType: unit
name: CUU00263
level: 7
types: Earth, Machine, Figure
attack: 750
defense: 650

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand where types = Machine]));
exec:
DESTROY(SELECT(1, [from field where cardType = [spell, item]]));
opponent.DAMAGE(100);