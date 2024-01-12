id: CUU00267
cardType: unit
name: CUU00267
level: 2
types: Dark, Plant
attack: 0
defense: 0

o: trigger
mandatory: no
after: summoned = thisCard
$exiled = EXILE(SELECT([1, 2, 3], [from you.discard]));
GAINLIFE(COUNT($exiled) * 100);

o: optional
turnLimit: 1
condition: thisCard.zone = field
DISCARD(thisCard);
APPLY(SELECT(1, [from opponent.field]), {defense -= 200}, endOfTurn);