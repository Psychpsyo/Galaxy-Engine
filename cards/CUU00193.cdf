id: CUU00193
cardType: unit
name: CUU00193
level: 1
types: Illusion, Beast
attack: 100
defense: 0

o: trigger
mandatory: no
after: summoned = thisCard
SUMMON(SELECT(1, [from you.hand where cardType = unit]));

o: trigger
mandatory: yes
during: currentPhase = endPhase & currentTurn.summoned(dueTo: effect, by: self != thisCard) = thisCard
condition: thisCard.zone = field
MOVE([from field where self = thisCard], baseOwner.hand);