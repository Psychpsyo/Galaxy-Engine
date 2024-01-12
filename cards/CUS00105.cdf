id: CUS00105
cardType: standardSpell
name: CUS00105
level: 0
types: Earth

o: cast
cost:
DISCARD(SELECT(1, [from you.hand]));
$unit = SELECT(1, [from field where cardType = unit]);
exec:
APPLY($unit, {defense += 300}, endOfTurn);