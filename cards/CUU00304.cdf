id: CUU00304
cardType: unit
name: CUU00304
level: 1
types: Wind, Psychic
attack: 100
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand where types = thisCard.types]));
exec:
APPLY(thisCard, {attack, defense += 100, abilities += CUU00304:1:1}, currentTurn.end);

|o: static
applyTo: [from you.field where self != thisCard & types = Psychic & cardType = unit]
condition: thisCard.zone = field
modifier: {attack += 100}