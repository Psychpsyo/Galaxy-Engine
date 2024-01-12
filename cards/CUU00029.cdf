id: CUU00029
cardType: unit
name: CUU00029
level: 1
types: Earth, Mage
attack: 0
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
$cards = SELECT(3, [from you.discard where types = Earth]);
exec:
MOVE([from discard where self = $cards], baseOwner.deck);
DRAW(1);