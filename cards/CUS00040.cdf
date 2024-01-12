id: CUS00040
cardType: standardSpell
name: CUS00040
level: 2
types:

o: cast
condition: currentPhase = opponent.drawPhase
opponent.GAINMANA(2);
DRAW(2);