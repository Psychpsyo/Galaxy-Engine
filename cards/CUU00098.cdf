id: CUU00098
cardType: unit
name: CUU00098
level: 7
types: Ice, Mage
attack: 700
defense: 400

o: trigger
during: attackers.owner = opponent
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand where types = Ice]));
exec:
APPLY(SELECT(1, [from attackers]), {attack = 0}, endOfTurn);