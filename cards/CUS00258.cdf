id: CUS00258
cardType: standardSpell
name: CUS00258
level: 2
types: Illusion

o: cast
$viewed = VIEW([from opponent.hand]);
if (COUNT([from $viewed where cardType = spell]) > 0) {
	$exiled = EXILE([from $viewed where cardType = spell]);
	opponent.DRAW?(COUNT($exiled));
};