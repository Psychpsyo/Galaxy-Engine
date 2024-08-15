id: CUS00243
cardType: standardSpell
name: CUS00243
level: 1
types: Water

o: cast
cost:
MOVE(SELECT(1, [from you.discard where types = Water]), baseOwner.deck);
$unit = SELECT(1, [from you.field where cardType = unit & types = Water]);
exec:
APPLY([from $unit where cardType = unit], {level += 3}, currentTurn.end);
APPLY([from $unit where cardType = unit], {attack += 300}, currentTurn.end);

o: trigger
mandatory: no
after: discarded(from: [hand, deck]) = thisCard
gameLimit: 1
MOVE(SELECT(1, [from you.discard where types = Water & name != CUS00243]), baseOwner.deck);
MOVE([from discard where self = thisCard], hand);