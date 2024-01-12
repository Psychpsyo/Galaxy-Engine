id: CUS00134
cardType: standardSpell
name: CUS00134
level: 1
types: Electric

o: cast
after: declared.owner = opponent
cost:
LOSELIFE(100);
exec:
CANCELATTACK();
APPLY(attackers, {attack = 0}, endOfTurn);