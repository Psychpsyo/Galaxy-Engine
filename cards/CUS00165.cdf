id: CUS00165
cardType: standardSpell
name: CUS00165
level: 0
types:

o: cast
condition: attackers.owner = opponent
DISCARD(SELECT(1, [from you.hand]));
CANCELATTACK();