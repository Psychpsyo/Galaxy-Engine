id: CUU00215
cardType: unit
name: CUU00215
level: 0
types: Illusion, Water, Dragon
attack: 0
defense: 0

o: trigger
mandatory: no
after: declared = thisCard
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
APPLY(thisCard, {attack += attackTarget.level * 50}, endOfTurn);

o: optional
turnLimit: 1
condition: thisCard.zone = field
EXILE(SELECT(1, [from you.discard where types = Medicine]));
GAINLIFE(100);