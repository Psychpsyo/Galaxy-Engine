id: CUI00087
cardType: standardItem
name: CUI00087
level: 0
types: Medicine, Curse

o: deploy
cost:
$unit = SELECT(1, [from field where cardType = unit]);
exec:
PUTCOUNTERS($unit, Weakness, 1);
APPLY($unit, {defense -= 200}, endOfTurn);