id: CUS00022
cardType: standardSpell
name: CUS00022
level: 0
types:

o: cast
$type = SELECTTYPE(allTypes);
$moved = MOVE(SELECT(any, [from you.hand where types = $type]), deck);
MOVE(SELECT(1, [from you.deck where types = $type & level = COUNT($moved)]), hand);