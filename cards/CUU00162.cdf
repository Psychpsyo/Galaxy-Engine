id: CUU00162
cardType: unit
name: CUU00162
level: 2
types: Illusion, Dark
attack: 0
defense: 0

o: trigger
mandatory: no
turnLimit: 1
condition: thisCard.zone = field
after: COUNT([from destroyed(dueTo: fight, by: thisCard) where cardType = unit]) > 0
GIVEATTACK(thisCard);

o: trigger
mandatory: yes
during: currentPhase = endPhase & COUNT([from currentTurn.destroyed(dueTo: fight, by: thisCard) where cardType = unit]) > 0
condition: thisCard.zone = field
APPLY(thisCard, {level += 2});
APPLY(thisCard, {attack, defense += 200});