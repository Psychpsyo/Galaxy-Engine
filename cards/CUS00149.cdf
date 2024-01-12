id: CUS00149
cardType: standardSpell
name: CUS00149
level: 0
types: Gravity

o: cast
$card = SELECT(1, [from field where types = Machine]);
MOVE(SELECT(1, [from you.deck where name = $card.name]), hand);