id: CUU00292
cardType: unit
name: CUU00292
level: 2
types: Fire, Psychic
attack: 200
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
EXILE(DECKTOP(1));
exec:
EXILE(DECKTOP(opponent, 1));

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
$viewed = both.VIEW?(DECKTOP?(you, 3));
if (COUNT([from $viewed where types = Psychic]) > 0) {
	$choice = SELECT(1, [from $viewed where types = Psychic]);
	MOVE($choice, hand);
	MOVE($viewed - $choice, you.deckTop);
} else {
	MOVE($viewed, you.deckTop);
};