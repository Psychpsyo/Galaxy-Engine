id: CUS00230
cardType: standardSpell
name: CUS00230
level: 1
types:

o: cast
cost:
LOSELIFE(100);
exec:
MOVE(SELECT(1, [from exile where level < 5 & cardType = unit]), baseOwner.hand);