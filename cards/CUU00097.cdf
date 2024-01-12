id: CUU00097
cardType: unit
name: CUU00097
level: 8
types: Dark, Machine, Dragon
attack: 800
defense: 800

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {attack, defense unaffectedBy self != thisCard}