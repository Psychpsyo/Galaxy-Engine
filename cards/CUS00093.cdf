id: CUS00093
cardType: standardSpell
name: CUS00093
level: 0
types:

o: cast
$exiled = EXILE(DECKTOP(opponent, 1));
if (COUNT([from opponent.discard where name = $exiled.name]) > 0) {
	EXILE([from opponent.discard where name = $exiled.name]);
};