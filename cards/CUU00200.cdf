id: CUU00200
cardType: unit
name: CUU00200
level: 0
types: Illusion, Dark, Demon
attack: 0
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field
MOVE(SELECT(1, [from you.deck where name = CUI00006]), hand);
opponent.DRAW(1);

o: optional
turnLimit: 1
condition: thisCard.zone = field & currentTurn.deployed.name = CUI00006
APPLY(SELECT(1, [from you.field where cardType = unit]), {types += Dark}, currentTurn.end);