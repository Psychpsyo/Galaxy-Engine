id: CUI00041
cardType: standardItem
name: CUI00041
level: 2
types: Dark

o: deploy
cost:
LOSELIFE(100);
exec:
DAMAGE(opponent, 100);
if (COUNT([from you.discard where name = CUI00041]) > 0) {
	DAMAGE(opponent, COUNT([from you.discard where name = CUI00041]) * 50);
};