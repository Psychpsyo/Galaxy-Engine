id: CUS00019
cardType: continuousSpell
name: CUS00019
level: 1
types: Water

o: fast
turnLimit: 1
condition: thisCard.zone = field & currentTurn = you.turn & COUNT([from you.unitZone]) = 0
SUMMON(SELECT(1, [from you.discard where level > 0]));