id: CUU00128
cardType: unit
name: CUU00128
level: 0
types: Electric
attack: 0
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field
DISCARD(SELECT(1, [from you.hand]));
APPLY(SELECT(1, [from field where cardType = unit]), {attack += 100}, endOfTurn);