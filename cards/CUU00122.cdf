id: CUU00122
cardType: unit
name: CUU00122
level: 3
types: Illusion, Ghost
attack: 300
defense: 200

o: optional
turnLimit: 1
condition: thisCard.zone = field
$type = SELECTTYPE(allTypes);
APPLY(thisCard, {types += $type}, endOfOpponentNextTurn);