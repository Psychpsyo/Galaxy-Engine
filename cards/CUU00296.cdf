id: CUU00296
cardType: unit
name: CUU00296
level: 1
types: Wind, Bird, Warrior
attack: 100
defense: 100
deckLimit: 1

o: trigger
mandatory: no
condition: thisCard.zone = field
after: COUNT($summoned{[from summoned(dueTo: effect, by: types = Wind, from: hand, to: you.field) where types = Bird & cardType = unit]}) > 0
afterPrecondition: thisCard.zone = field
APPLY(SELECT(1, [from $summoned where cardType = unit]), {attack += 200}, currentTurn.end);
