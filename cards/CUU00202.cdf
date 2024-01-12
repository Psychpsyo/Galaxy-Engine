id: CUU00202
cardType: unit
name: CUU00202
level: 7
types: Water, Earth, Fish, Ghost
attack: 700
defense: 400

o: trigger
mandatory: no
after: summoned(from: discard, dueTo: effect, by: self != thisCard) = thisCard
DESTROY(SELECT(1, [from field where cardType = [spell, item]]));
opponent.DAMAGE(100);