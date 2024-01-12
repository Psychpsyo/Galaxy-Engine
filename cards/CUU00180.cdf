id: CUU00180
cardType: unit
name: CUU00180
level: 1
types: Dark, Demon
attack: 0
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
$cardChoice = SELECT(1, [from you.hand where types = Dark]);
DISCARD($cardChoice);
exec:
SUMMON(SELECT(1, [from you.discard where level > $cardChoice.level]));