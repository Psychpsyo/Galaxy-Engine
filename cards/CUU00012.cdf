id: CUU00012
cardType: unit
name: CUU00012
level: 8
types: Earth, Rock, Myth
attack: 800
defense: 700

o: fast
turnLimit: 1
condition: thisCard.zone = field
$discarded = DISCARD(SELECT(any, [from you.hand where types = Earth]));
APPLY(thisCard, {defense += COUNT($discarded) * 100}, endOfNextTurn);

o: optional
turnLimit: 1
condition: thisCard.zone = field
DISCARD(SELECT(1, [from you.hand where types = Earth]));
DESTROY(SELECT(1, [from field where cardType = [spell, item]]));