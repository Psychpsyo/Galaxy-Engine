id: CUS00062
cardType: standardSpell
name: CUS00062
level: 0
types:

o: cast
SUMMON(SELECT(1, [from you.hand where cardType = unit]), opponent.field);
DRAW(1);