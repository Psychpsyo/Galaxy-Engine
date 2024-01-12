id: CUU00134
cardType: unit
name: CUU00134
level: 6
types: Ice, Demon, Samurai
attack: 600
defense: 500

o: optional
turnLimit: 2
condition: thisCard.zone = field
DESTROY(SELECT(1, [from you.field where self != thisCard]));
APPLY(thisCard, {attack += 300}, endOfTurn);