id: CUI00046
cardType: equipableItem
name: CUI00046
level: 2
types: Light, Sword

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {attack += COUNT([from you.field where types = Light & self != thisCard]) * 100}