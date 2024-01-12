id: CUU00052
cardType: unit
name: CUU00052
level: 1
types: Earth, Warrior
attack: 100
defense: 100

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {attack += COUNT([from thisCard.equipments where cardType = equipableItem]) * 100}