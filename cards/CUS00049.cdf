id: CUS00049
cardType: standardSpell
name: CUS00049
level: 3
types: Earth, Landmine

o: cast
after: declared.owner = opponent
DESTROY(SELECT(1, [from attackers where owner = opponent & cardType = unit & defense > 399]));