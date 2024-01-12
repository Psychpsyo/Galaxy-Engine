id: CUS00167
cardType: standardSpell
name: CUS00167
level: 1
types:

o: cast
after: discarded.cardType = unit
MOVE(SELECT(1, [from exile]), baseOwner.discard);