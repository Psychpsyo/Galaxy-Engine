id: CUU00172
cardType: unit
name: CUU00172
level: 3
types: Earth, Plant, Angel
attack: 0
defense: 300

o: trigger
mandatory: yes
after: summoned = thisCard
GAINLIFE(100);

o: trigger
mandatory: no
after: retired = thisCard
MOVE(SELECT(1, [from you.deck where types = [Earth, Plant] & level > 4 & cardType = unit]), hand);