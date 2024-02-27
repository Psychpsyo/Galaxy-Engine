id: CUU00287
cardType: unit
name: CUU00287
level: 3
types: Ice, Demon, Beast
attack: 400
defense: 400

o: static
applyTo: thisCard
condition: thisCard.zone = field & COUNT([from field where self != thisCard & types = Ice & cardType = unit]) = 0
modifier: {attack, defense -= 300}

o: trigger
mandatory: no
condition: thisCard.zone = field
after: COUNT([from destroyed(dueTo: fight, by: thisCard) where cardType = unit & types = Ice]) > 0
DRAW(1);