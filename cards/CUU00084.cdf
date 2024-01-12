id: CUU00084
cardType: unit
name: CUU00084
level: 1
types: Water, Angel
attack: 0
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
GAINLIFE(200);