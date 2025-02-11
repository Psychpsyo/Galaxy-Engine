id: CUS00256
cardType: standardSpell
name: CUS00256
level: 0
types: Earth, Plant

o: cast
condition: COUNT([from you.field where name = CUT00008]) >= 2
SUMMONTOKENS(2, CUT00008, 1, [Earth, Plant], 100, 100, no);

o: trigger
mandatory: no
after: discarded(from: hand) = thisCard
APPLY([from you.field where name = CUT00008], {attack, defense += 200}, currentTurn.end);