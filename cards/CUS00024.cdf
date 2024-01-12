id: CUS00024
cardType: standardSpell
name: CUS00024
level: 0
types:

o: cast
cost:
$unit = SELECT(1, [from field where cardType = unit]);
exec:
APPLY($unit, {defense += 100}, endOfTurn);