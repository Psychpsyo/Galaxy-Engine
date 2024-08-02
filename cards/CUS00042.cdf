id: CUS00042
cardType: standardSpell
name: CUS00042
level: 3
types: Boundary

o: cast
cost:
$unit = SELECT(1, [from field]);
exec:
APPLY({prohibit destroyed = $unit}, currentTurn.end);