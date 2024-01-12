id: CUU00102
cardType: unit
name: CUU00102
level: 10
types: Wind, Angel, Myth
attack: 0
defense: 0

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {attack, defense += COUNT([from you.deck]) * 50}

o: optional
turnLimit: 1
condition: thisCard.zone = field
MOVE([from field where cardType = [spell, item]], baseOwner.deck);