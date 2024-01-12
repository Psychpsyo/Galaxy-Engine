id: CUU00066
cardType: unit
name: CUU00066
level: 1
types: Wind, Warrior
attack: 100
defense: 100

o: trigger
mandatory: no
after: discarded(from: hand) = thisCard
SUMMON([from discard where self = thisCard]);