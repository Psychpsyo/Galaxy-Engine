id: CUI00086
cardType: continuousItem
name: CUI00086
level: 2
types: Illusion, Light, Structure

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
LOSELIFE(100);
exec:
MOVE(SELECT(1, [from you.discard where types = Angel]), baseOwner.deckTop);