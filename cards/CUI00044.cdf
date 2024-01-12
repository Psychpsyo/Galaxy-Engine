id: CUI00044
cardType: standardItem
name: CUI00044
level: 1
types: Fire

o: deploy
cost:
LOSELIFE(100);
$card = SELECT(1, [from you.discard where level > 1]);
exec:
DISCARD(SELECT($card.level, [from you.hand where types = Fire]));
MOVE([from discard where self = $card], you.hand);