id: CUS00028
cardType: standardSpell
name: CUS00028
level: 0
types:

o: cast
cost:
$unit = SELECT(1, [from discard where cardType = unit]);
exec:
SUMMON([from $unit where cardType = unit], you.field);