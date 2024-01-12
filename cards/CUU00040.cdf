id: CUU00040
cardType: unit
name: CUU00040
level: 1
types: Wind, Bird
attack: 100
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field
exec:
SUMMON(SELECT(1, [from you.hand where cardType = unit & types = Wind]));