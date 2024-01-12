id: CUU00282
cardType: unit
name: CUU00282
level: 3
types: Dark, Demon, Book
attack: 300
defense: 200

o: optional
turnLimit: 3
condition: thisCard.zone = field
EXILE(SELECT(1, [from discard where types = Book]));
APPLY(thisCard, {attack, defense += 100, level += 1}, endOfOpponentNextTurn);