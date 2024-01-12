id: CUU00183
cardType: unit
name: CUU00183
level: 3
types: Illusion, Ice, Light, Wind, Bird
attack: 0
defense: 200

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
LOSELIFE(200);
exec:
$unit = SELECT(1, [from exile where cardType = unit]);
APPLY(thisCard, {attack += $unit.attack}, endOfTurn);