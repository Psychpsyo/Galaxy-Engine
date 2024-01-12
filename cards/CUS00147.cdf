id: CUS00147
cardType: standardSpell
name: CUS00147
level: 0
types: Light

o: cast
after: COUNT([from targeted where types = Light & owner = you]) > 0
CANCELATTACK();