id: CUU00110
cardType: unit
name: CUU00110
level: 1
types: Light, Angel, Mage
attack: 0
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
MOVE(SELECT(1, [from you.deck where types = Book]), hand);

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
LOSELIFE(100);
exec:
MOVE(ORDER(SELECT(3, [from you.discard where types = Book], DIFFERENT(name))), baseOwner.deckBottom);