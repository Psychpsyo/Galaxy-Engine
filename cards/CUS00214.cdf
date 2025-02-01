id: CUS00214
cardType: standardSpell
name: CUS00214
level: 1
types: Psychic
turnLimit: 1

o: cast
$name = SELECTCARDNAME();
$exiled = EXILE(DECKTOP(opponent, 1));
if ($exiled.name = $name) {
	DRAW(2);
};