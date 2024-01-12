id: CUU00174
cardType: unit
name: CUU00174
level: 1
types: Illusion, Beast
attack: 0
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
SUMMONTOKENS(1, CUT00015, 0, [Illusion, Beast], 0, 0);
APPLY(thisCard, {canAttack = no}, endOfTurn);

o: optional
turnLimit: 1
condition: thisCard.zone = field
$exiled = EXILE(SELECT(1, [from you.discard where types = thisCard.types]));
APPLY(SELECT(1, [from you.field where name = CUT00015]), {baseAttack += $exiled.level * 50}, endOfTurn);