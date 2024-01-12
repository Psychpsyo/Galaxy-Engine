id: CUI00081
cardType: standardItem
name: CUI00081
level: 0
types: Illusion, Structure
deckLimit: 1

o: deploy
SWAP(
	you.partner,
	SELECT(
		1,
		[from you.deck where
			name != you.partner.name &
			types = you.partner.types &
			level = you.partner.level
		]
	)
);
EXILE(thisCard);