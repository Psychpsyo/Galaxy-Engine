id: CUS00058
cardType: standardSpell
name: CUS00058
level: 0
types:

o: cast
cost:
$unit = SELECT(1, [from field where cardType = unit & level < you.partner.level]);
exec:
DISCARD(SELECT(1, [from you.hand]));
APPLY([from $unit where cardType = unit], {cancelAbilities}, endOfTurn);