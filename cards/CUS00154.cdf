id: CUS00154
cardType: standardSpell
name: CUS00154
level: 2
types:

o: cast
condition: COUNT(attackers) = 1 & attackers.owner = you
DESTROY(attackers);
APPLY(attackTarget, {defense = 0}, endOfTurn);