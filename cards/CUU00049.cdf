id: CUU00049
cardType: unit
name: CUU00049
level: 1
types: Light, Warrior
attack: 100
defense: 100

o: trigger
mandatory: no
after: destroyed = thisCard
SUMMON(SELECT(1, [from you.deck where name = CUU00049]));