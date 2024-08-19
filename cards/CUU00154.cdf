id: CUU00154
cardType: unit
name: CUU00154
level: 4
types: Dark, Dragon, Ghost, Curse
attack: 450
defense: 200

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {unaffectedBy self != thisCard & cardType = [enchantSpell, equipableItem]}