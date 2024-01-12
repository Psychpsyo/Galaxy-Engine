id: CUU00216
cardType: unit
name: CUU00216
level: 1
types: Light, Bug
attack: 50
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field
GAINLIFE(50);

o: trigger
mandatory: no
after: destroyed = thisCard
MOVE(SELECT(1, [from deck where types = Light & cardType = continuousItem]), hand);