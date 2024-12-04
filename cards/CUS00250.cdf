id: CUS00250
cardType: standardSpell
name: CUS00250
level: 0
types: Light, Angel

o: cast
MOVE(SELECT([3, 4, 5], [from you.discard where name = CUS00071 | (types = Light & cardType = unit)]), baseOwner.deck);
DRAW(1);
if (COUNT([from you.field where types = Angel & cardType = unit]) > 0) {
	DRAW(1);
};

o: trigger
mandatory: no
after: discarded(from: deck) = thisCard
cost:
LOSELIFE(100);
exec:
MOVE([from discard where self = thisCard], baseOwner.deckTop);