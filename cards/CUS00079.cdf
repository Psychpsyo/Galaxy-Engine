id: CUS00079
cardType: standardSpell
name: CUS00079
level: 2
types:
condition: COUNT([from exile]) > 5
turnLimit: 1

o: cast
EXILE([from field where cardType = [spell, item]]);
EXILE(DECKTOP(5)) & EXILE(opponent.DECKTOP(5));