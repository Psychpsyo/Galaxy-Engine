id: CUI00005
cardType: standardItem
name: CUI00005
level: 0
types: Medicine

o: deploy
cost:
$unit = SELECT(1, [from field where cardType = unit]);
exec:
APPLY($unit, {attack += 300}, endOfTurn);