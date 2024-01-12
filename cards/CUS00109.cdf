id: CUS00109
cardType: continuousSpell
name: CUS00109
level: 1
types: Fire, Wind
condition: currentTurn = you.turn

o: trigger
turnLimit: 1
mandatory: no
after: declared.owner = opponent
condition: thisCard.zone = field
EXILE(SELECT(2, [from you.discard]));
CANCELATTACK();
DAMAGE(100);