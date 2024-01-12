id: CUS00016
cardType: standardSpell
name: CUS00016
level: 4
types:

o: cast
cost:
$unit = SELECT(1, [from opponent.field where cardType = unit]);
exec:
APPLY($unit, {defense = 0});