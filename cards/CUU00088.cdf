id: CUU00088
cardType: unit
name: CUU00088
level: 2
types: Wind, Bird, Mage
attack: 0
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field
$cards = SELECT(3, [from you.discard where types = Wind & cardType = spell]);
$choice = SELECT(2, $cards);
EXILE($choice);
MOVE($cards - $choice, you.hand);