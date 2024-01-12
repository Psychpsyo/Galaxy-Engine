id: CUU00047
cardType: unit
name: CUU00047
level: 0
types: Fire
attack: 0
defense: 0

o: trigger
mandatory: yes
after: COUNT([from summoned where level < 2 & owner = you]) > 0
condition: thisCard.zone = field
GAINLIFE(50);