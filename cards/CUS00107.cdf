id: CUS00107
cardType: continuousSpell
name: CUS00107
level: 0
types: Fire

o: trigger
mandatory: no
turnLimit: 2
after: COUNT([from discarded(from: you.deck) where types = Fire]) > 0
condition: thisCard.zone = field
SUMMONTOKENS(1, CUT00009, 0, Fire, 0, 0);