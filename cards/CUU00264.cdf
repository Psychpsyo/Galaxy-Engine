id: CUU00264
cardType: unit
name: CUU00264
level: 2
types: Water, Plant, Bug
attack: 100
defense: 100

o: trigger
mandatory: no
after: declared = thisCard
APPLY(thisCard, {attack += 100});