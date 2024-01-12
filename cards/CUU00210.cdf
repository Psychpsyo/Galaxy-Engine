id: CUU00210
cardType: unit
name: CUU00210
level: 0
types: Electric, Machine
attack: 0
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
opponent.DAMAGE(100);