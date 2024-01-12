id: CUS00044
cardType: standardSpell
name: CUS00044
level: 5
types:

o: cast
DRAW(2);

o: trigger
mandatory: yes
after: discarded(from: [hand, deck]) = thisCard
DRAW(1);