id: CUS00161
cardType: standardSpell
name: CUS00161
level: 0
types:

o: cast
MOVE(SELECT(1, [from you.field where cardType = unit & !isToken]), baseOwner.hand);