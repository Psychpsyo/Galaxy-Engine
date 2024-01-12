id: CUS00067
cardType: standardSpell
name: CUS00067
level: 3
types: Electric, Landmine

o: cast
condition: COUNT([from unitZone]) > 2
after: declared.owner = opponent
DISCARD(SELECT(1, [from you.hand]));
DESTROY([from field where cardType = unit]);