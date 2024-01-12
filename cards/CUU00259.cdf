id: CUU00259
cardType: unit
name: CUU00259
level: 3
types: Light, Mage
attack: 300
defense: 250

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand where cardType = spell]));
exec:
DRAW(1);