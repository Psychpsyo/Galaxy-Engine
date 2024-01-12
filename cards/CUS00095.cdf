id: CUS00095
cardType: standardSpell
name: CUS00095
level: 1
types:

o: cast
$card = SELECT(1, [from exile]);
MOVE(SELECT(1, [from you.deck where name = $card.name]), hand);