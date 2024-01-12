id: CUS00178
cardType: standardSpell
name: CUS00178
level: 1
types: Curse

o: cast
cost:
LOSELIFE(100);
exec:
APPLY([from field where types = Curse], {attack -= COUNT([from discard where cardType = unit]) * 100}, endOfTurn);