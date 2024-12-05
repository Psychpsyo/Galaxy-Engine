id: CUS00010
cardType: standardSpell
name: CUS00010
level: 0
types:

o: cast
cost:
$units = SELECT(3+, [from you.discard where cardType = unit & COUNT(types) > 0], DIFFERENT(types));
exec:
$summoned = SUMMON([from $units where cardType = unit & zone = discard]);
at(currentTurn.end) {
	DESTROY([from $summoned where cardType = unit]);
};