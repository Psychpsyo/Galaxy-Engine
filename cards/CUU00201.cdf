id: CUU00201
cardType: unit
name: CUU00201
level: 1
types: Dark, Warrior, Ghost, Curse
attack: 100
defense: 100
deckLimit: any

o: trigger
mandatory: no
after: summoned(from: discard, dueTo: effect, by: self != thisCard) = thisCard
APPLY(thisCard, {attack += 100});