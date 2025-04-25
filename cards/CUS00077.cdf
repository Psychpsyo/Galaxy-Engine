id: CUS00077
cardType: standardSpell
name: CUS00077
level: 1
types: Landmine

o: cast
after: damageDealt(to: you, dueTo: fights, by: owner = opponent) > 0
MOVE(SELECT(2, [from you.deck where types = Landmine], DIFFERENT(name)), hand);
