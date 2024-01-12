id: CUU00006
cardType: unit
name: CUU00006
level: 1
types: Fire, Spirit
attack: 100
defense: 0

o: trigger
mandatory: no
after: COUNT([from summoned where types = thisCard.types & owner = you]) > 0
condition: thisCard.zone = field
opponent.DAMAGE(50);