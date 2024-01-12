id: CUS00048
cardType: standardSpell
name: CUS00048
level: 3
types: Fire, Landmine

o: cast
after: declared.owner = opponent
DESTROY(SELECT(1, [from attackers where owner = opponent & cardType = unit & defense < 301]));