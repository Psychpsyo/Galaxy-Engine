id: CUU00275
cardType: unit
name: CUU00275
level: 2
types: Earth, Beast, Machine
attack: 200
defense: 100

o: trigger
mandatory: no
after: COUNT([from destroyed(from: you.field) where self != thisCard & types = Beast & cardType = unit]) > 0
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
MOVE(SELECT(1, [from you.deck where name = CUU00275]), you.field);