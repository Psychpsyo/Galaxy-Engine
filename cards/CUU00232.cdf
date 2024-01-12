id: CUU00232
cardType: unit
name: CUU00232
level: 2
types: Electric, Beast
attack: 200
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand where types = thisCard.types]));
exec:
SUMMON(SELECT(1, [from you.deck where name = CUU00232]));

o: optional
turnLimit: 1
condition: thisCard.zone = field & currentTurn.summoned != thisCard
cost:
EXILE(SELECT(1, [from you.discard where types = Electric]));
exec:
APPLY(thisCard, {level += 1});