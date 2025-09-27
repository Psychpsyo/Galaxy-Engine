id: CUS00215
cardType: standardSpell
name: CUS00215
level: 1
types: Curse

o: cast
condition: attackers.owner = opponent
$exiled = EXILE(SELECT(2, [from you.discard where level = 1~4], DIFFERENT(name)));
if (COUNT([from opponent.field where level <= SUM($exiled.level)]) > 0) {
	DESTROY(SELECT(1, [from opponent.field where level <= SUM($exiled.level)]));
};
