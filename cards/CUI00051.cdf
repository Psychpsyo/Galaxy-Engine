id: CUI00051
cardType: continuousItem
name: CUI00051
level: 1
types: Water

o: optional
turnLimit: 1
condition: thisCard.zone = field
MOVE(SELECT(1, [from you.exile where types = Water & cardType = unit]), you.deckBottom);
GAINLIFE(100);