id: CUS00057
cardType: standardSpell
name: CUS00057
level: 1
types: Light, Wind

o: cast
cost:
$unit = SELECT(1, [from field where cardType = unit]);
exec:
APPLY($unit, {defense -= 200}, endOfTurn);