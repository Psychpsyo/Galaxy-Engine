id: CUS00051
cardType: enchantSpell
name: CUS00051
level: 1
types: Wind

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {attack += 100, attack += 200 if types = Wind}