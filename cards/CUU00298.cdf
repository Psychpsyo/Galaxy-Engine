id: CUU00298
cardType: unit
name: CUU00298
level: 6
types: Ice, Plant, Warrior
attack: 500
defense: 500

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {attack += COUNT([from field where self != thisCard & types = Ice & cardType = unit]) * 100}

o: trigger
mandatory: no
condition: thisCard.zone = field
after: COUNT(destroyed(dueTo: fights, by: thisCard)) > 0
cost:
DISCARD(SELECT(1, [from you.hand where types = Ice & cardType = [spell, item]]));
exec:
DESTROY(SELECT(1, [from opponent.field where level <= 4 & cardType = unit]));