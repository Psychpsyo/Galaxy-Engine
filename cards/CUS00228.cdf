id: CUS00228
cardType: standardSpell
name: CUS00228
level: 1
types:

o: cast
after: COUNT([from destroyed(dueTo: fight) where level > 2 & cardType = unit & owner = you]) > 0
MOVE(SELECT(1, [from you.hand where level < 4 & cardType = unit]), you.field);
DRAW(1);