id: CUU00008
cardType: unit
name: CUU00008
level: 1
types: Earth, Spirit
attack: 0
defense: 100

o: static
applyTo: [from you.field where types = thisCard.types]
condition: thisCard.zone = field
modifier: {cancel destroyed = self}
mandatory: no
zoneDurationLimit: 1