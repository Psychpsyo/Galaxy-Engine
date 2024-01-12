id: CUU00107
cardType: unit
name: CUU00107
level: 1
types: Dark, Beast, Curse
attack: 100
defense: 100
deckLimit: any

o: optional
turnLimit: 1
condition: thisCard.zone = field
PUTCOUNTERS(SELECT(1, [from unitZone where types != Curse]), Weakness, 1);

o: trigger
mandatory: no
after: COUNT([from destroyed where GETCOUNTERS(self, Weakness) > 0]) > 0
condition: thisCard.zone = field
SUMMON(SELECT(1, [from you.deck where name = CUU00107]));