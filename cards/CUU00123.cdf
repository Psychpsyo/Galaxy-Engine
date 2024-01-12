id: CUU00123
cardType: unit
name: CUU00123
level: 5
types: Light, Dark, Demon
attack: 500
defense: 400

o: optional
turnLimit: 1
condition: thisCard.zone = exile
VIEW(SELECT(1, [from opponent.hand], yes, yes));