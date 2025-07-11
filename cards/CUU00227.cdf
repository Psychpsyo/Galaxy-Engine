id: CUU00227
cardType: unit
name: CUU00227
level: 3
types: Dark, Bug, Curse
attack: 300
defense: 200

o: trigger
mandatory: no
during: currentPhase = endPhase & COUNT([from currentTurn.destroyed(dueTo: fights, by: thisCard) where cardType = unit]) > 0
condition: thisCard.zone = field
EXILE(thisCard);
$moved = MOVE(SELECT(1, [from you.hand, you.deck where name = CUU00228]), you.field);
PUTCOUNTERS($moved, Emergence, 1);
