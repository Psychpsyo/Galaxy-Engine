id: CUU00261
cardType: unit
name: CUU00261
level: 7
types: Water, Dragon
attack: 700
defense: 600

o: trigger
mandatory: no
after: summoned = thisCard
cost:
DISCARD(1, [from you.hand]);
exec:
DESTROY(SELECT(1, [from field where level < 7]));
APPLY(thisCard, {canAttack = no}, endOfTurn);