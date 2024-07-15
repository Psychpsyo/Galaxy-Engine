id: CUI00116
cardType: standardItem
name: CUI00116
level: 0
types: Fire, Water, Ghost

o: deploy
$discarded = DISCARD(DECKTOP(1));
if ($discarded.types = thisCard.types) {
	DISCARD(DECKTOP(1));
};

o: trigger
mandatory: yes
after: discarded(from: [hand, deck]) = thisCard
DISCARD(DECKTOP(1));