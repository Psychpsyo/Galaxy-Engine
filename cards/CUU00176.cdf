id: CUU00176
cardType: unit
name: CUU00176
level: 8
types: Ice, Plant, Angel
attack: 800
defense: 400

o: trigger
mandatory: no
during: currentPhase = opponent.endPhase
condition: thisCard.zone = field
DISCARD(SELECT(1, [from you.hand where types = Ice]));
opponent.DAMAGE(200)

o: trigger
mandatory: no
after: destroyed(from: field) = thisCard & COUNT([from you.discard where name = CUS00176]) > 0
DESTROY(SELECT(2, [from you.field where types = thisCard.types]));
MOVE([from discard where self = thisCard], field);