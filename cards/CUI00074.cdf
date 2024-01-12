id: CUI00074
cardType: standardItem
name: CUI00074
level: 1
types: Dark, Fire

o: deploy
cost:
DISCARD(SELECT(1, [from you.hand where types = Dark & cardType = unit]));
exec:
GAINLIFE(300);
DRAW(1);