id: CUU00289
cardType: unit
name: CUU00289
level: 4
types: Earth, Rock, Dragon
attack: 0
defense: 500

o: static
modifier: {prohibit destroyed(dueTo: [from fights where COUNT([from participants where cardType = unit & attack >= 900]) > 0 ]) = thisCard}

o: trigger
mandatory: no
after: retired = thisCard
APPLY({prohibit destroyed = [from you.field where cardType = unit & types = thisCard.types]}, currentTurn.end);
