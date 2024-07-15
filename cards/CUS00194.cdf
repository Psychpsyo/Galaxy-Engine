id: CUS00194
cardType: standardSpell
name: CUS00194
level: 1
types:

o: cast
$destroyed = DESTROY(SELECT(1, [from you.field where cardType = unit]));
if (COUNT([from field where level <= $destroyed.level & cardType = [spell, item]]) > 0) {
	DESTROY([from field where level <= $destroyed.level & cardType = [spell, item]]);
};