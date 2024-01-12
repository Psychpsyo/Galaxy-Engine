id: CUU00238
cardType: unit
name: CUU00238
level: 4
types: Light, Angel, Mage
attack: 0
defense: 400

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand where cardType = spell]));
exec:
MOVE(SELECT(1, [from discard where cardType = unit]), baseOwner.deckBottom);