id: CUS00015
cardType: standardSpell
name: CUS00015
level: 3
types:

o: cast
condition: COUNT(attackers) = 1 & attackers.level < 2 & attackers.owner = you
APPLY(attackers, {attack += attackTarget.level * 100}, endOfTurn);