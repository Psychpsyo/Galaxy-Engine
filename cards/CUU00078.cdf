id: CUU00078
cardType: unit
name: CUU00078
level: 2
types: Electric, Beast
attack: 200
defense: 100

o: trigger
mandatory: no
after: declared.owner = opponent
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand where types = thisCard.types]));
exec:
CANCELATTACK();