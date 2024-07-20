id: CUS00187
cardType: standardSpell
name: CUS00187
level: 0
types:

o: cast
cost:
LOSELIFE(100);
exec:
SHUFFLE();
$viewed = both.VIEW(DECKTOP(you, 1));
if ($viewed.level = 7) {
	MOVE($viewed, you.hand);
} else {
	EXILE($viewed);
};

o: trigger
mandatory: no
after: discarded(dueTo: effect, by: name = CUS00187) = thisCard
MOVE([from exile where self = thisCard], hand);