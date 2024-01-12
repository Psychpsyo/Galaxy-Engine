id: CUS00145
cardType: continuousSpell
name: CUS00145
level: 1
types: Water

o: trigger
mandatory: yes
after: COUNT([from destroyed(from: field) where cardType = unit]) > 0
condition: thisCard.zone = field
APPLY(SELECT(1, [from unitZone where cardType = unit]), {attack, defense -= 100}, endOfTurn);