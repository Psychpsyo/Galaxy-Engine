id: CUU00071
cardType: unit
name: CUU00071
level: 0
types: Water, Dark
attack: 0
defense: 0

o: trigger
mandatory: no
after: destroyed = thisCard
SUMMON(SELECT(1, [from you.deck where level < 5 & types = Fish & cardType = unit]));