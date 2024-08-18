id: CUU00289
cardType: unit
name: CUU00289
level: 4
types: Earth, Rock, Dragon
attack: 0
defense: 500

o: static
condition: COUNT([from fights.participants where cardType = unit & attack >= 900]) > 0
modifier: {prohibit destroyed(dueTo: fight) = thisCard}

o: trigger
mandatory: no
after: retired = thisCard
APPLY({prohibit destroyed = [from you.field where cardType = unit & types = thisCard.types]}, currentTurn.end);