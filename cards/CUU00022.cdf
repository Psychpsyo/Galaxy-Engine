id: CUU00022
cardType: unit
name: CUU00022
level: 1
types: Water, Spirit
attack: 0
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
$items = SELECT(2, [from you.discard where cardType = equipableItem], DIFFERENT(name));
exec:
$chosen = opponent.SELECT(1, $items);
MOVE([from discard where self = $chosen], baseOwner.hand);
MOVE([from discard where self = $items - $chosen], baseOwner.deck);