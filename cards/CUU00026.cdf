id: CUU00026
cardType: unit
name: CUU00026
level: 2
types: Earth, Mage
attack: 100
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
$unit = SELECT(1, [from field where types = Earth & cardType = unit]);
exec:
APPLY([from $unit where cardType = unit], {attack += COUNT([from you.field where self != thisCard & types = Earth]) * 100}, endOfOpponentNextTurn);
APPLY(thisCard, {canAttack = no}, endOfTurn);