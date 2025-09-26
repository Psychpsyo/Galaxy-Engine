id: CUU00241
cardType: unit
name: CUU00241
level: 2
types: Illusion, Ghost, Psychic
attack: 200
defense: 50

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
EXILE(SELECT(2, [from you.discard where types = thisCard.types]));
exec:
MOVE(SELECT(1, [from field where level <= 2 & cardType = [spell, item]]), baseOwner.hand);

o: trigger
mandatory: no
after: damageDealt(dueTo: fights, by: thisCard, to: opponent) > 0
condition: thisCard.zone = field
DISCARD(SELECT(1, [from opponent.hand], yes, yes));
