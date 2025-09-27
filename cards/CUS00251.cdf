id: CUS00251
cardType: standardSpell
name: CUS00251
level: 1
types: Bug

o: cast
$unit = SELECT(1, [from you.unitZone where level <= 3 & types = Bug & cardType = unit]);
$summoned = SUMMON(SELECT(1~2, [from you.hand, you.deck where name = $unit.name]), no);
at(currentTurn.end) {
	DESTROY([from $summoned where cardType = unit]);
};
