id: CUU00277
cardType: unit
name: CUU00277
level: 1
types: Light, Machine
attack: 100
defense: 50
deckLimit: 8

o: optional
turnLimit: 1
condition: thisCard.zone = field
SUMMON(SELECT(1, [from you.hand where name = [CUU00277, CUU00211]]));

o: trigger
mandatory: no
condition: thisCard.zone = field
during: currentPhase = you.drawPhase
opponent.DAMAGE(50);
APPLY(thisCard, {canAttack = no}, endOfTurn);