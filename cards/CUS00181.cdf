id: CUS00181
cardType: standardSpell
name: CUS00181
level: 1
types: Electric, Wind

o: cast
cost:
EXILE(SELECT(1, [from you.discard where types = Electric & cardType = unit]));
exec:
APPLY(SELECT(1, [from field where level < 8]), {attack, defense /= 2}, endOfTurn);