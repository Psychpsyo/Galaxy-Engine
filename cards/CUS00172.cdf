id: CUS00172
cardType: standardSpell
name: CUS00172
level: 1
types: Fire

o: cast
SUMMON(
	SELECT(1, [from you.hand where level <= COUNT([from opponent.discard]) & types = Fire & cardType = unit]),
	{replace manaLost > 0 with LOSEMANA(manaLost \ 2);}
);