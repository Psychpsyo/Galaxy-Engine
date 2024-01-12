id: CUI00021
cardType: standardItem
name: CUI00021
level: 1
types: Illusion, Rock

o: deploy
cost:
$type = SELECTTYPE([Earth, Fire, Water, Wind, Ice, Electric, Light, Dark]);
exec:
APPLY(SELECT(1, [from field where cardType = unit]), {types += $type}, endOfTurn);