id: CUI00090
cardType: standardItem
name: CUI00090
level: 0
types: Figure

o: deploy
$unit = SUMMON(SELECT(1, [from discard where cardType = unit]), baseOwner.field);
if ($unit.baseTypes != Figure) {
	at (currentTurn.end) {
		DISCARD([from $unit where cardType = unit]);
	};
};