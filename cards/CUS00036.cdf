id: CUS00036
cardType: standardSpell
name: CUS00036
level: 1
types: Light

o: cast
$unit = SELECT(1, [from field, discard where owner = opponent & cardType = unit]);
APPLY(SELECT(1, [from you.field where cardType = unit]), {types += $unit.types, abilities += $unit.abilities}, endOfTurn);