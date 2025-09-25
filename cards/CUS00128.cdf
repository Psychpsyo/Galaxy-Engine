id: CUS00128
cardType: standardSpell
name: CUS00128
level: 0
types:

o: cast
after: COUNT($destroyed{[from destroyed(dueTo: fights) where owner = opponent]}) > 0
DRAW(1);
if ([from $destroyed where cardType = unit].level >= 6) {
	DRAW(1);
};
