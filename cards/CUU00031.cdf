id: CUU00031
cardType: unit
name: CUU00031
level: 0
types: Earth, Wind, Fire, Water, Mage
attack: 0
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field
SUMMON(SELECT(1, [from you.hand where types = thisCard.types & cardType = unit]), {replace manaLost > 0 with LOSEMANA(manaLost * 2);});

o: optional
turnLimit: 1
condition: thisCard.zone = field & COUNT(currentTurn.retired(byPlayer: you)) > 1
MOVE(SELECT(1, [from you.deck where level > 5 & cardType = unit]), you.hand);