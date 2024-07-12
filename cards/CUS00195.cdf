id: CUS00195
cardType: standardSpell
name: CUS00195
level: 1
types:

o: cast
$destroyed = DESTROY(SELECT(1, [from you.field where level >= 2 & types = Rock]));
you.may {
	MOVE(SELECT(1, [from you.deck where types = Rock & level <= $destroyed.level \ 2]), hand);
};