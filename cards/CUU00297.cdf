id: CUU00297
cardType: unit
name: CUU00297
level: 2
types: Ice, Plant
attack: 0
defense: 200

o: trigger
mandatory: yes
condition: thisCard.zone = field
after: COUNT(drawn(dueTo: standardDraw, byPlayer: you)) > 0
APPLY(thisCard, {level += 2});

o: trigger
mandatory: no
after: retired = thisCard
cost:
DISCARD(SELECT(1, [from you.hand where types = Ice]));
exec:
MOVE(SELECT(1, [from you.deck where types = Ice & types = Plant & cardType = unit]), hand);