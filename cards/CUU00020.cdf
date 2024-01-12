id: CUU00020
cardType: unit
name: CUU00020
level: 1
types: Ice, Angel
attack: 100
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
LOSELIFE(100);
exec:
APPLY(SELECT(1, [from field where types != Ice & cardType = unit]), {canAttack = no}, endOfOpponentNextTurn);