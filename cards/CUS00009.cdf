id: CUS00009
cardType: standardSpell
name: CUS00009
level: 0
types:
turnLimit: 1

o: cast
SWAP(
	you.partner,
	SELECT(
		1,
		[from you.deck where
			cardType = unit &
			name != you.partner.name &
			types = you.partner.types &
			level = you.partner.level
		]
	),
	yes
);