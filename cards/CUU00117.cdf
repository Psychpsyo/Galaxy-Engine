id: CUU00117
cardType: unit
name: CUU00117
level: 6
types: Light, Illusion, Dragon, Ghost
attack: 0
defense: 0

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {attack += COUNT([from you.hand]) * 200}

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {defense += COUNT([from you.hand]) * 100}

o: trigger
mandatory: no
after: destroyed(dueTo: fight) = thisCard
MOVE([from discard where self = thisCard], baseOwner.hand);