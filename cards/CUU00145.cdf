id: CUU00145
cardType: unit
name: CUU00145
level: 3
types: Electric, Wind, Beast
attack: 300
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
APPLY(SELECT(1, [from opponent.field]), {defense -= 100}, endOfTurn);

o: trigger
mandatory: no
turnLimit: 1
after: targeted = thisCard
condition: thisCard.zone = field
EXILE(SELECT(2, [from you.discard where types = thisCard.types]));
CANCELATTACK();