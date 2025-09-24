id: CUU00302
cardType: unit
name: CUU00302
level: 1
types: Water
attack: 50
defense: 100

o: trigger
mandatory: no
after: destroyed = thisCard
MOVE(SELECT(1, [from you.deck where (cardType = unit & types = Water & COUNT(types) = 1) | name = CUS00193]), hand);