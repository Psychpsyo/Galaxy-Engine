id: CUS00151
cardType: standardSpell
name: CUS00151
level: 0
types:

o: cast
$units = SELECT(2, [from you.field where !isToken & level >= 1 & cardType = unit]);
$toDiscard = SELECT(1, $units);
DISCARD($toDiscard);
APPLY([from $units - $toDiscard where cardType = unit], {prohibit destroyed(dueTo: effect) = self}, currentTurn.end);