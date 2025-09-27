id: CUS00004
cardType: standardSpell
name: CUS00004
level: 1
types: Water, Dark

o: cast
cost:
$selected = SELECT(2, [from you.discard where types = Water]);
exec:
SUMMON(SELECT(1~2, [from you.deck where name = CUU00071]));
MOVE([from discard where self = $selected], deck);
