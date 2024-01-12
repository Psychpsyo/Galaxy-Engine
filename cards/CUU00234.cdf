id: CUU00234
cardType: unit
name: CUU00234
level: 3
types: Fire, Earth, Demon, Rock
attack: 250
defense: 200

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
$discarded = DISCARD(SELECT(1, [from you.hand where cardType = unit]));
exec:
APPLY(thisCard, {attack += $discarded.level * 50}, endOfTurn);