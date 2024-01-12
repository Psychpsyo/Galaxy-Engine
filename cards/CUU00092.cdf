id: CUU00092
cardType: unit
name: CUU00092
level: 4
types: Ice, Beast
attack: 400
defense: 300

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {attack += COUNT([from you.field where self != thisCard & types = Ice]) * 50}