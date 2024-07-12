id: CUS00104
cardType: standardSpell
name: CUS00104
level: 1
types: Fire
turnLimit: 1
condition: currentTurn = you.turn

o: cast
DAMAGE(opponent, COUNT([from you.exile where types = Fire]) * 50);
you.may {
	MOVE(SELECT(1, [from you.deck where name = CUS00104]), hand);
};