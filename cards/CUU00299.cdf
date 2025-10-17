id: CUU00299
cardType: unit
name: CUU00299
level: 4
types: Dark, Beast, Curse
attack: 400
defense: 300

o: trigger
mandatory: no
after: COUNT([from targeted where zone = you.field & types = Beast & cardType = unit]) > 0
cost:
EXILE([from discard where self = thisCard]);
exec:
CANCELATTACK();
