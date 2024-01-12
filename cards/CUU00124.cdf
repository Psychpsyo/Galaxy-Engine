id: CUU00124
cardType: unit
name: CUU00124
level: 1
types: Electric, Spirit
attack: 100
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field & DIFFERENT([from you.field].name)
APPLY(SELECT(1, [from opponent.field where cardType = unit]),
	{attack, defense -= COUNT([from you.field where cardType = unit & self != thisCard & types = thisCard.types])},
	endOfTurn
);