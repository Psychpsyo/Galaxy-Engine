id: CUU00136
cardType: unit
name: CUU00136
level: 5
types: Fire, Wind, Ghost
attack: 400
defense: 500

o: optional
turnLimit: 1
condition: thisCard.zone = field
$exiled = EXILE(SELECT([1, 2, 3], [from you.discard where cardType = unit]));
APPLY(thisCard, {attack += COUNT($exiled) * 100}, endOfTurn);
DAMAGE(100);