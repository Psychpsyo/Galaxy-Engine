id: CUS00113
cardType: standardSpell
name: CUS00113
level: 1
types: Ghost

o: cast
$discarded = DISCARD(SELECT(any, [from you.field where cardType = unit & types = Ghost]));
GAINMANA(COUNT($discarded) + 1);