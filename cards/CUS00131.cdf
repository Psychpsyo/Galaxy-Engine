id: CUS00131
cardType: standardSpell
name: CUS00131
level: 0
types:

o: cast
cost:
DISCARD(SELECT(1, [from you.hand]));
$unit = SELECT(1, [from field where types = Machine]);
exec:
APPLY($unit, {prohibit destroyed(dueTo: effect) = self}, currentTurn.end);