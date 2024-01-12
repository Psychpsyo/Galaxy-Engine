id: CUS00034
cardType: standardSpell
name: CUS00034
level: 1
types: Electric, Light

o: cast
condition: COUNT([from you.field where types = Electric]) > 0
APPLY([from field where types != Electric], {defense -= 200, attack = 0}, endOfTurn);