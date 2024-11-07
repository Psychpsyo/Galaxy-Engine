id: CUU00274
cardType: unit
name: CUU00274
level: 1
types: Dark, Demon, Mage
attack: 100
defense: 100

o: trigger
after: COUNT([from destroyed where self != thisCard & cardType = unit & owner = you]) > 0
condition: thisCard.zone = field
cost:
LOSELIFE(200);
exec:
$discarded = DISCARD(SELECT([1,2], [from you.hand]));
$summoned = SUMMON(SELECT(1, [from you.deck where types = Demon & level = SUM($discarded.level)]));
if (COUNT($discarded) = 2) {
	APPLY($summoned, {abilities += CUU00274:1:1});
};

|o: static
applyTo: thisCard
modifier: {attackRights = 2}