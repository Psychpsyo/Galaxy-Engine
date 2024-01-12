id: CUS00047
cardType: standardSpell
name: CUS00047
level: 1
types: Ice, Landmine

o: cast
after: declared.owner = opponent
DESTROY(SELECT(1, [from attackers where owner = opponent & cardType = unit & defense < 101]));