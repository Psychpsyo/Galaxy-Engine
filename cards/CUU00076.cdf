id: CUU00076
cardType: unit
name: CUU00076
level: 3
types: Wind, Bird
attack: 300
defense: 200

o: optional
turnLimit: 1
condition: thisCard.zone = field
MOVE(SELECT(1, [from field where cardType = [spell, item]]), baseOwner.hand);