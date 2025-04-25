id: CUS00229
cardType: standardSpell
name: CUS00229
level: 2
types: Light

o: cast
condition: currentTurn = opponent.turn
after: COUNT([from destroyed(dueTo: fights) where level <= 4 & owner = you]) > 0
cost:
DISCARD(SELECT(1, [from you.hand where types = Light]));
exec:
$exiled = EXILE(SELECT(1, [from opponent.field where level <= 7]));
if (COUNT([from field where name = $exiled.name]) > 0) {
	DESTROY([from field where name = $exiled.name]);
};
