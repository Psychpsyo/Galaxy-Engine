id: CUU00062
cardType: unit
name: CUU00062
level: 4
types: Fire, Rock
attack: 400
defense: 300

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
$discarded = DISCARD(DECKTOP(2));
exec:
if ($discarded.types = Fire) {
	DAMAGE(opponent, COUNT([from $discarded where types = Fire]) * 50);
};