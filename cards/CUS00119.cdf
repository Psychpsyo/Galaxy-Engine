id: CUS00119
cardType: standardSpell
name: CUS00119
level: 1
types:

o: cast
after: COUNT([from destroyed(dueTo: fights) where cardType = unit & owner = you]) > 0
DESTROY(SELECT(1, [from field where cardType = [spell, item]]));
DRAW(1);
