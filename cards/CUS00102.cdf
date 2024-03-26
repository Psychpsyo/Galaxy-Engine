id: CUS00102
cardType: standardSpell
name: CUS00102
level: 1
types: Wind

o: cast
condition: COUNT([from you.discard where types = Wind]) >= 3
MOVE(SELECT(2, [from you.deck where defense <= 200 & types = Wind & cardType = unit], DIFFERENT(name)), hand);
MOVE(SELECT(2, [from you.discard where types = Wind]), baseOwner.deck);