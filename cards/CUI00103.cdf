id: CUI00103
cardType: standardItem
name: CUI00103
level: 0
types:

o: deploy
MOVE(SELECT(3, [from you.discard where types = [Warrior, Mage] & level < 5 & cardType = unit], DIFFERENT(name)), baseOwner.deck);
DRAW(2);