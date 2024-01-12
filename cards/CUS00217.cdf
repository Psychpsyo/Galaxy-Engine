id: CUS00217
cardType: standardSpell
name: CUS00217
level: 0
types: Curse

o: cast
condition: COUNT([from field where types = Curse]) > 0
APPLY(SELECT(1, [from field]), {types += Curse});