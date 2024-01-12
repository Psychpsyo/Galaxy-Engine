id: CUI00078
cardType: standardItem
name: CUI00078
level: 0
types: Plant, Medicine

o: deploy
cost:
$unit = SELECT(1, [from field]);
exec:
APPLY($unit, {attack, defense += 100}, endOfOpponentNextTurn);