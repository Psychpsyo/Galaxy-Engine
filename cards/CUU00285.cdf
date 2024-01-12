id: CUU00285
cardType: unit
name: CUU00285
level: 0
types: Illusion, Mage, Machine
attack: 0
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field & COUNT([from you.field where name = CUI00111]) > 0
cost:
DISCARD(SELECT(2, [from you.hand]));
exec:
SWAP(thisCard, SELECT(1, [from you.deck where name = CUU00286]));