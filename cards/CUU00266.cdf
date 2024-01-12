id: CUU00266
cardType: unit
name: CUU00266
level: 3
types: Fire, Earth, Dragon, Warrior
attack: 100
defense: 300

o: trigger
mandatory: no
after: targeted = thisCard
condition: thisCard.zone = field
$discarded = DISCARD(SELECT([1, 2], [from you.hand where types = Dragon]));
APPLY(thisCard, {defense += COUNT($discarded) * 200}, endOfTurn);