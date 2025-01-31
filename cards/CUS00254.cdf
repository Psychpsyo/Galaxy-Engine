id: CUS00254
cardType: standardSpell
name: CUS00254
level: 0
types:

o: cast
APPLY([from you.field where cardType = unit], {attack, defense += 100}, nextTurn.end);

o: trigger
mandatory: no
after: COUNT(retired(byPlayer: you)) > 0 & thisCard.zone = discard
MOVE([from discard where self = thisCard], baseOwner.hand);