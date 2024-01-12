id: CUS00054
cardType: continuousSpell
name: CUS00054
level: 1
types: Wind

o: fast
turnLimit: 1
condition: thisCard.zone = field
SUMMON(SELECT(1, [from you.hand where types = Wind]));