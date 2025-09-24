id: CUS00268
cardType: standardSpell
name: CUS00268
level: 2
types: Wind, Psychic

o: cast
condition: attackers.owner = opponent
cost:
MOVE(SELECT(1, [from you.field where types = thisCard.types & cardType = unit]), baseOwner.hand);
$cards = SELECT(2, [from opponent.field where self != both.partner], SUM(level) <= 3);
exec:
MOVE($cards, baseOwner.hand);
