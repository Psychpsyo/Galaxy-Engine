id: CUS00043
cardType: standardSpell
name: CUS00043
level: 1
types:

o: cast
$exiled = EXILE(SELECT([1, 2, 3], [from you.discard where cardType = spell]));
GAINMANA(COUNT($exiled));