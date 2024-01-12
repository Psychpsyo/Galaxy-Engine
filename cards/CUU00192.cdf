id: CUU00192
cardType: unit
name: CUU00192
level: 4
types: Ice, Dragon
attack: 300
defense: 400

o: optional
turnLimit: 1
condition: thisCard.zone = field
DESTROY(SELECT(1, [from you.field where self != thisCard & types = Ice]));
APPLY(thisCard, {attackRights = 2}, endOfTurn);