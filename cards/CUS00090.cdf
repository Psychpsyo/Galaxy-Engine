id: CUS00090
cardType: standardSpell
name: CUS00090
level: 2
types:

o: cast
$cards = both.SELECT(3, [from own.discard]);
both.MOVE(ORDER($cards), own.deckBottom);
both.DISCARD(DECKTOP(3));
EXILE(thisCard);