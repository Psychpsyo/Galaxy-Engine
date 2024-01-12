id: CUS00094
cardType: standardSpell
name: CUS00094
level: 2
types:

o: cast
both.DRAW(1);

o: trigger
mandatory: yes
after: discarded(from: hand) = thisCard
both.DRAW(1);