id: CUS00222
cardType: standardSpell
name: CUS00222
level: 0
types: Gravity

o: cast
cost:
LOSELIFE(200);
exec:
SUMMONTOKENS?(4, CUT00029, 0, Machine, 0, 0, CUS00222:1:1, opponent.field);

[o: trigger
during: currentPhase = endPhase
mandatory: yes
DESTROY(thisCard);