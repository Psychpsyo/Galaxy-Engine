id: CUS00080
cardType: continuousSpell
name: CUS00080
level: 1
types: Wind
condition: currentTurn = you.turn

o: trigger
turnLimit: 1
mandatory: no
after: declared.owner = opponent
condition: thisCard.zone = field
DISCARD(SELECT(1, [from you.hand where types = Wind]));
CANCELATTACK();