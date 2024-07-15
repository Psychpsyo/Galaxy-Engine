id: CUS00137
cardType: continuousSpell
name: CUS00137
level: 2
types: Dark

o: fast
turnLimit: 1
condition: thisCard.zone = field
cost:
LOSELIFE(100);
exec:
$unit = SELECT(1, [from field where cardType = unit]);
if ($unit.types = Dark) {
	APPLY($unit, {attack, defense += 100}, currentTurn.end);
} else {
	APPLY($unit, {types += Dark}, currentTurn.end);
};