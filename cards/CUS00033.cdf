id: CUS00033
cardType: standardSpell
name: CUS00033
level: 1
types:

o: cast
cost:
$cards = SELECT(2, [from you.discard where cardType = item | (cardType = unit & types = Machine)]);
exec:
MOVE([from discard where self = $cards], you.hand);