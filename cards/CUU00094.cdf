id: CUU00094
cardType: unit
name: CUU00094
level: 7
types: Wind, Bug, Ghost
attack: 700
defense: 600

o: optional
turnLimit: 1
condition: thisCard.zone = field
$destroyed = DESTROY(SELECT(1, [from you.field where self != thisCard & cardType = unit]));
APPLY(thisCard, {attack += $destroyed.level * 100}, endOfTurn);

o: optional
turnLimit: 1
condition: thisCard.zone = field
DESTROY(SELECT(1, [from you.field where self != thisCard & cardType = unit]));
APPLY(thisCard, {attackRights = 2}, endOfTurn);