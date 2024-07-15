id: CUS00196
cardType: standardSpell
name: CUS00196
level: 1
types: Electric, Light

o: cast
condition: COUNT([from you.exile where types = Electric]) >= 4
$viewed = both.VIEW(you.DECKTOP(2));
if ($viewed.types = Electric) {
	MOVE([from $viewed where types = Electric], hand);
};
MOVE(ORDER([from $viewed where types != Electric]), deckBottom);