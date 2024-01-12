id: CUS00132
cardType: standardSpell
name: CUS00132
level: 2
types: Fire

o: cast
DAMAGE(100);
DRAW(1);

o: trigger
mandatory: yes
after: discarded(from: [hand, deck]) = thisCard
condition: you.partner.types = Fire
DAMAGE(100);
both.DRAW(1);