id: CUS00112
cardType: standardSpell
name: CUS00112
level: 2
types:

o: cast
condition: attackers.owner = opponent
DISCARD(SELECT(1, [from you.deck where level < 2 & cardType = unit]));
CANCELATTACK();