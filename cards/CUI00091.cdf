id: CUI00091
cardType: standardItem
name: CUI00091
level: 1
types: Light

o: deploy
cost:
LOSELIFE(100);
exec:
VIEW([from opponent.hand]);
you.may {
	MOVE(SELECT(1, [from you.deck where name = [CUI00082, CUI00092]]), hand);
};