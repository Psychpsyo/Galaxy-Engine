id: CUS00103
cardType: standardSpell
name: CUS00103
level: 0
types: Earth

o: cast
$card = SELECT(1, [from you.deck where types = Rock]);
SHUFFLE($card);
MOVE($card, deckTop);