id: CUS00097
cardType: standardSpell
name: CUS00097
level: 0
types: Gravity

o: cast
cost:
DISCARD(SELECT(1, [from you.hand]));
$unit = SELECT(1, [from field where cardType = unit]);
exec:
APPLY($unit, {attack = 0}, endOfTurn);