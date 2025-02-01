id: CUI00056
cardType: continuousItem
name: CUI00056
level: 2
types: Book

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
LOSELIFE(150);
exec:
$name = SELECTCARDNAME();
$card = both.VIEW(DECKTOP(you, 1));
if ($card.name = $name) {
	MOVE($card, you.hand);
} else {
	MOVE($card, you.deck);
};