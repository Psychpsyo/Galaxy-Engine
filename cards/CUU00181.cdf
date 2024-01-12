id: CUU00181
cardType: unit
name: CUU00181
level: 2
types: Dark, Ghost, Curse
attack: 200
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = discard
cost:
EXILE(thisCard);
exec:
APPLY(SELECT(1, [from opponent.field where cardType = unit]), {defense -= 100}, endOfTurn);