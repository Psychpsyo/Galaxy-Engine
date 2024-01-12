id: CUU00073
cardType: unit
name: CUU00073
level: 3
types: Water, Fish
attack: 100
defense: 200

o: trigger
mandatory: no
after: summoned = thisCard
SUMMON(SELECT(1, [from you.deck where name = CUU00074]));