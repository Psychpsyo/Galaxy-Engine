id: CUS00086
cardType: standardSpell
name: CUS00086
level: 1
types: Landmine

o: cast
after: COUNT([from summoned(byPlayer: opponent)]) > 0 & currentPhase = opponent.mainPhase1
MOVE(SELECT(2, [from you.discard where types = Landmine], DIFFERENT(name)), baseOwner.hand);
EXILE(thisCard);