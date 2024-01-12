id: CUU00064
cardType: unit
name: CUU00064
level: 4
types: Fire, Psychic
attack: 400
defense: 200

o: optional
turnLimit: 1
condition: thisCard.zone = field & currentPhase = you.mainPhase1
opponent.DAMAGE(COUNT([from you.field where types = Fire & cardType = unit]) * 50);
APPLY(you, {canEnterBattlePhase = no}, endOfTurn);