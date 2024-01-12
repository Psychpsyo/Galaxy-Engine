id: CUI00042
cardType: standardItem
name: CUI00042
level: 2
types: Water

o: deploy
cost:
LOSELIFE(200);
exec:
EXILE(SELECT(5, [from you.discard], DIFFERENT(name)));
DRAW(2);