id: CUU00225
cardType: unit
name: CUU00225
level: 1
types: Illusion, Beast, Mage, Ghost
attack: 100
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand where cardType = unit]));
exec:
MOVE(SELECT(1, [from you.deck, you.discard where name = CUI00083]), hand);