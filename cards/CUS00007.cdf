id: CUS00007
cardType: standardSpell
name: CUS00007
level: 2
types: Earth

o: cast
$gained = GAINLIFE(COUNT([from field where types = Earth & cardType = unit]) * 50);
DRAW(1);
if ($gained >= 200) {
	DRAW(1);
};