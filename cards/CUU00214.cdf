id: CUU00214
cardType: unit
name: CUU00214
level: 2
types: Dark, Demon
attack: 100
defense: 200

o: trigger
mandatory: no
after: discarded(from: [hand, field]) = thisCard
DISCARD(SELECT(1, [from you.deck where level <= 6 & types = Warrior]));