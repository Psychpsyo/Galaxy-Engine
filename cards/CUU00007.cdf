id: CUU00007
cardType: unit
name: CUU00007
level: 1
types: Water, Spirit
attack: 100
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field
$amount = COUNT([from you.field where types = thisCard.types & self != thisCard]);
if ($amount > 0) {
	SUMMON(SELECT(1, [from you.discard where level <= $amount & cardType = unit & name != [from you.field where cardType = unit].name]));
};