id: CUU00032
cardType: unit
name: CUU00032
level: 6
types: Light, Mage
attack: 600
defense: 500

o: trigger
mandatory: no
after: summoned = thisCard
MOVE(SELECT(1, [from you.discard where level < 2 & cardType = spell]), baseOwner.hand);