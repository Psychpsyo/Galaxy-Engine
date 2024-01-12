id: CUU00067
cardType: unit
name: CUU00067
level: 3
types: Wind, Demon
attack: 300
defense: 0

o: trigger
turnLimit: 1
mandatory: no
after: declared.owner = opponent
condition: thisCard.zone = field
MOVE(SELECT(1, [from you.discard where types = Wind]), deck);
CANCELATTACK();