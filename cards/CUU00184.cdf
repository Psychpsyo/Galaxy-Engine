id: CUU00184
cardType: unit
name: CUU00184
level: 2
types: Wind, Dark, Beast, Bird
attack: 200
defense: 100

o: trigger
mandatory: yes
after: summoned(from: hand, dueTo: effect) = thisCard
APPLY(thisCard, {attack += 100}, endOfTurn);

o: trigger
mandatory: no
condition: thisCard.zone = field
after: COUNT([from destroyed(dueTo: fight, by: thisCard) where cardType = unit]) > 0
DESTROY(SELECT(1, [from opponent.field where cardType = [spell, item]]));
MOVE([from field where self = thisCard], baseOwner.hand);