id: CUU00061
cardType: unit
name: CUU00061
level: 4
types: Dark, Beast
attack: 400
defense: 300

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {attack += COUNT([from discard where name = CUU00061]) * 50}

o: trigger
after: destroyed = thisCard
mandatory: no
MOVE(SELECT(1, [from you.deck where name = CUU00061]), hand);