id: CUS00202
cardType: standardSpell
name: CUS00202
level: 1
types:

o: cast
cost:
LOSELIFE(100);
exec:
MOVE(SELECT(1, [from field where baseOwner = you]), you.hand);