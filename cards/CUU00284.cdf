id: CUU00284
cardType: unit
name: CUU00284
level: 3
types: Wind, Dragon, Chain
attack: 300
defense: 200

o: trigger
mandatory: no
after: summoned = thisCard
cost:
DISCARD(SELECT(1, [from you.hand]));
$unit = SELECT(1, [from opponent.field where cardType = unit]);
exec:
APPLY([from $unit where cardType = unit], {canAttack, canCounterattack = no}, endOfNextTurn);