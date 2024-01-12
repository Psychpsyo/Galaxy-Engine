id: CUS00130
cardType: standardSpell
name: CUS00130
level: 4
types: Curse, Landmine

o: cast
after: declared.owner = opponent
$destroyed = DESTROY(SELECT(1, [from attackers where owner = opponent & cardType = unit]));
DAMAGE($destroyed.level * 50);