id: CUS00239
cardType: standardSpell
name: CUS00239
level: 2
types: Water

o: cast
$discarded = DISCARD(SELECT(any, [from you.hand where types = Water]));
DRAW(COUNT($discarded));