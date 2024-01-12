id: CUU00014
cardType: unit
name: CUU00014
level: 8
types: Water, Fish, Myth
attack: 800
defense: 200

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {replace destroyed = thisCard with APPLY(thisCard, {defense -= 100});}
mandatory: no

o: trigger
mandatory: no
after: summoned(from: discard, dueTo: effect, by: self != thisCard) = thisCard
APPLY(thisCard, {attack += 100});