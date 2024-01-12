id: CUS00102
cardType: standardSpell
name: CUS00102
level: 1
types: Fire, Katana

o: cast
condition: COUNT([from you.discard where types = Wind]) > 2
MOVE(SELECT(2, [from you.deck where defense < 201 & types = Wind & cardType = unit], DIFFERENT(name)), hand);
MOVE(SELECT(2, [from you.discard where types = Wind]), baseOwner.deck);