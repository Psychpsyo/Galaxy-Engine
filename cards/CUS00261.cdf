id: CUS00261
cardType: standardSpell
name: CUS00261
level: 1
types: Machine, Landmine

o: cast
condition: currentTurn = opponent.turn
after: COUNT([from destroyed(dueTo: fights) where level <= 3 & types = Machine & cardType = unit]) > 0
DESTROY(SELECT(1, [from opponent.field where cardType = unit]));
