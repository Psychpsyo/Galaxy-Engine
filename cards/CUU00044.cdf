id: CUU00044
cardType: unit
name: CUU00044
level: 2
types: Earth, Machine
attack: 200
defense: 200

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
opponent.DAMAGE(50);