id: CUS00166
cardType: standardSpell
name: CUS00166
level: 0
types: Light

o: cast
$cards = SELECT(2, [from you.deck where level < 9 & types = Angel]);
SHUFFLE($cards);
MOVE(ORDER($cards), deckTop);