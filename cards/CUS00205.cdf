id: CUS00205
cardType: standardSpell
name: CUS00205
level: 0
types:

o: cast
APPLY(SELECT(1, [from unitZone where cardType = unit]), {level += 3}, endOfTurn);