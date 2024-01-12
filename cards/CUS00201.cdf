id: CUS00201
cardType: standardSpell
name: CUS00201
level: 1
types:

o: cast
DESTROY(SELECT(1, [from you.field where cardType = unit]));
DRAW(1);