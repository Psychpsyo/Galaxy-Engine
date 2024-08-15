id: CUU00252
cardType: unit
name: CUU00252
level: 0
types: Illusion, Psychic
attack: 0
defense: 50

o: optional
turnLimit: 1
condition: thisCard.zone = field
SUMMON(SELECT(1, [from you.hand where level >= 1 & types = Psychic & cardType = unit]));

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
EXILE(SELECT(1, [from you.discard where types = Psychic]));
exec:
VIEW(SELECT(1, [from opponent.hand], yes, yes));