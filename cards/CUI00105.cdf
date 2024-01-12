id: CUI00105
cardType: standardItem
name: CUI00105
level: 0
types: Curse

o: deploy
SUMMON(SELECT(1, [from you.discard where cardType = unit]), opponent.unitZone, no);
DRAW(1);