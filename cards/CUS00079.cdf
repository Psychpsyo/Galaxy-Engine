id: CUS00079
cardType: standardSpell
name: CUS00079
level: 2
types:
condition: COUNT([from exile]) >= 6
turnLimit: 1

o: cast
EXILE([from field where cardType = [spell, item]]);
both.EXILE?(DECKTOP?(5));