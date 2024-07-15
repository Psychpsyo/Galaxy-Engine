id: CUS00108
cardType: continuousSpell
name: CUS00108
level: 1
types: Earth, Water

o: fast
turnLimit: 1
condition: thisCard.zone = field & currentTurn = you.turn
$viewed = both.VIEW(you.DECKTOP(1));
if ($viewed.types = Earth) {
	DISCARD($viewed);
	GAINLIFE(100);
} else {
	MOVE($viewed, you.deckTop);
};