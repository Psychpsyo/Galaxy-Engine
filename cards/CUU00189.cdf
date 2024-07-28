id: CUU00189
cardType: unit
name: CUU00189
level: 4
types: Light, Angel, Machine, Warrior
attack: 200
defense: 200

o: trigger
mandatory: no
after: summoned(from: hand) = thisCard
$destroyed = DESTROY(SELECT(any, [from you.field where cardType = unit]));
APPLY(thisCard, {attackRights += COUNT($destroyed)}, currentTurn.end);