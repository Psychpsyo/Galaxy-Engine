id: CUS00240
cardType: standardSpell
name: CUS00240
level: 1
types: Wind

o: cast
REVEAL(SELECT(1, [from opponent.hand where !isRevealed], yes, yes), currentTurn.end);
you.may {
	MOVE(SELECT(1, [from you.deck, you.discard where name = CUS00240]), hand);
};