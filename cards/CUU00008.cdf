id: CUU00008
cardType: unit
name: CUU00008
level: 1
types: Earth, Spirit
attack: 0
defense: 100

o: static
condition: thisCard.zone = field
modifier: {cancel destroyed = [from you.field where self != thisCard & types = thisCard.types]}
mandatory: no
zoneDurationLimit: 1