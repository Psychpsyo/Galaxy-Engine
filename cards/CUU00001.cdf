id: CUU00001
cardType: unit
name: CUU00001
level: 7
types: Light, Dark, Earth, Water, Fire, Wind, Ice, Electric, Mage
attack:700
defense: 600

o: optional
zoneDurationLimit: 1
condition: thisCard.zone = field
cost:
$manaAmount = SELECTNUMBER(1~thisCard.level);
LOSEMANA($manaAmount);
exec:
MOVE(SELECT(1, [from you.deck where level = $manaAmount & cardType = spell]), hand);

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
$unit = SELECT(1, [from you.field where cardType = unit]);
exec:
$type = SELECTTYPE(thisCard.types);
APPLY([from $unit where cardType = unit], {types += $type}, currentTurn.end);
