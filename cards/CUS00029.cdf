id: CUS00029
cardType: standardSpell
name: CUS00029
level: 1
types: Wind

o: cast
cost:
$card = SELECT(1, [from field where cardType = item | (types = Machine & cardType = unit)]);
exec:
DESTROY($card);