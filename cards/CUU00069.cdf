id: CUU00069
cardType: unit
name: CUU00069
level: 3
types: Earth, Demon
attack: 300
defense: 200

o: trigger
mandatory: no
after: summoned = thisCard
MOVE(SELECT(1, [from you.discard where types = Rock]), baseOwner.hand);