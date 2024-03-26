id: CUS00153
cardType: continuousSpell
name: CUS00153
level: 0
types:

o: trigger
mandatory: no
after: COUNT([from retired(byPlayer: you) where level > 0]) > 1
condition: thisCard.zone = field
DRAW(2);