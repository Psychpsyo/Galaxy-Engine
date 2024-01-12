id: CUI00050
cardType: standardItem
name: CUI00050
level: 1
types: Curse

o: deploy
cost:
$unit = SELECT(1, [from unitZone where cardType = unit]);
exec:
APPLY([from $unit where cardType = unit], {attack, defense -= 300});
APPLY([from $unit where cardType = unit], {level += 2})