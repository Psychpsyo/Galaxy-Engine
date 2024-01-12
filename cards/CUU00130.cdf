id: CUU00130
cardType: unit
name: CUU00130
level: 2
types: Water, Mage, Fish
attack: 100
defense: 200

o: optional
zoneDurationLimit: 1
condition: thisCard.zone = field & currentPhase = you.mainPhase
DISCARD(SELECT(1, [from you.hand]));
DESTROY(SELECT(1, [from field where cardType = spell]));