id: CUS00147
cardType: standardSpell
name: CUS00147
level: 0
types: Light

o: cast
after: COUNT([from targeted where owner = you & types = Light & cardType = unit]) > 0
CANCELATTACK();
