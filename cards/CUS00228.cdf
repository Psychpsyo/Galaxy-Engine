id: CUS00228
cardType: standardSpell
name: CUS00228
level: 1
types:

o: cast
after: COUNT([from destroyed(dueTo: fights) where level >= 3 & cardType = unit & owner = you]) > 0
MOVE(SELECT(1, [from you.hand where level <= 3 & cardType = unit]), you.field);
DRAW(1);
