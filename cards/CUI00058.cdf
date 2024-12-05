id: CUI00058
cardType: standardItem
name: CUI00058
level: 1
types: Medicine

o: deploy
$unit = SELECT(1, [from unitZone where types = Psychic]);
APPLY($unit, {attack += defense});
APPLY($unit, {attackRights = 2});
at (currentTurn.end) {
	DESTROY([from $unit where cardType = unit]);
};