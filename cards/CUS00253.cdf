id: CUS00253
cardType: standardSpell
name: CUS00253
level: 2
types: Dark
turnLimit: 1
condition: currentTurn = you.turn

o: cast
condition: you.partner.name = CUU00135
EXILE?(DECKTOP?(you, 3));
if (COUNT([from you.exile where level <= 3 & attack = 0 & defense = 0 & cardType = unit]) > 0) {
	$summoned = SUMMON(SELECT(1, [from you.exile where level <= 3 & attack = 0 & defense = 0 & cardType = unit]), no);
	if (COUNT($summoned) > 0) {
		EXILE?(DECKTOP?(opponent, $summoned.level + 1));
	};
};

o: trigger
mandatory: no
after: exiled = thisCard
MOVE(SELECT(1, [from you.exile where attack = 0 & defense = 0 & cardType = unit]), baseOwner.deck);