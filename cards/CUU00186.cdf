id: CUU00186
cardType: unit
name: CUU00186
level: 2
types: Electric, Light, Mage
attack: 200
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
$unit = SELECT(1, [from field where self != thisCard & level <= 5 & cardType = unit]);
exec:
$viewed = both.VIEW(DECKTOP(you, 1));
if ($viewed.types = thisCard.types) {
	DISCARD($viewed);
	APPLY([from $unit where cardType = unit], {cancelAbilities}, currentTurn.end);
} else {
	MOVE($viewed, you.deck);
	you.SHUFFLE();
};