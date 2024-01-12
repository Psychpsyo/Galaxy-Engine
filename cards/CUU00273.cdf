id: CUU00273
cardType: unit
name: CUU00273
level: 2
types: Fire, Illusion, Beast
attack: 200
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
$discards = DISCARD?(DECKTOP?(COUNT([from you.field where types = [Beast, Bird]])));
APPLY(thisCard, {attack += COUNT([from $discards.discarded where cardType = unit]) * 100}, endOfTurn);