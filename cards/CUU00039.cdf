id: CUU00039
cardType: unit
name: CUU00039
level: 0
types: Illusion, Ghost
attack: 0
defense: 0

o: fast
turnLimit: 1
condition: thisCard.zone = field
cost:
$unit = SELECT(1, [from field where cardType = unit]);
exec:
APPLY(thisCard, {name = [from $unit where cardType = unit].name, types += [from $unit where cardType = unit].types}, endOfTurn);