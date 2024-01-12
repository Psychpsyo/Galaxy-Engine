id: CUU00065
cardType: unit
name: CUU00065
level: 1
types: Wind, Mage
attack: 100
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
LOSELIFE(100);
exec:
$discarded = DISCARD(SELECT(1, [from you.hand where COUNT(types) > 0]));
MOVE(SELECT(1, [from you.deck where types = Wind & level = $discarded.level]), hand);