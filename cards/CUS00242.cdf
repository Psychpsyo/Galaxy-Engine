id: CUS00242
cardType: standardSpell
name: CUS00242
level: 1
types:

o: cast
condition: currentTurn = you.turn
after: COUNT([summoned(byPlayer: opponent), cast(byPlayer: opponent), deployed(byPlayer: opponent)]) > 0
cost:
$unit = SELECT(1, [from you.field where cardType = unit]);
exec:
APPLY($unit, {attackRights = 2}, currentTurn.end);