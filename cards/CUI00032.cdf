id: CUI00032
cardType: standardItem
name: CUI00032
level: 1
types: Medicine

o: deploy
cost:
$unit = SELECT(1, [from field where level <= 5 & cardType = unit]);
exec:
APPLY($unit, {cancelAbilities}, currentTurn.end);