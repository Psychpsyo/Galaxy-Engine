id: CUU00226
cardType: unit
name: CUU00226
level: 0
types: Ice, Angel, Plant
attack: 0
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand where types = Ice]));
exec:
APPLY([from you.field where types = Ice & isToken], {level += 1});

o: trigger
mandatory: no
during: currentPhase = you.endPhase
condition: thisCard.zone = field & COUNT([from unitZone where types = Ice & cardType = unit]) > 3
MOVE(SELECT(1, [from you.deck where level > 4 & types = Ice]), hand);