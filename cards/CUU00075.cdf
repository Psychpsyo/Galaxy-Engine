id: CUU00075
cardType: unit
name: CUU00075
level: 2
types: Water, Light, Fish
attack: 100
defense: 100

o: trigger
mandatory: no
after: destroyed = thisCard
MOVE(SELECT(1, [from you.deck where types = Fish]), hand);