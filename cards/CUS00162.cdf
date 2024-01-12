id: CUS00162
cardType: standardSpell
name: CUS00162
level: 0
types: Ice, Wind

o: cast
after: COUNT([from destroyed where types = Ice & owner = you]) > 0
APPLY(SELECT(1, [from opponent.field]), {attack = 0}, endOfTurn);