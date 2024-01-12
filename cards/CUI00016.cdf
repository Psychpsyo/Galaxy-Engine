id: CUI00016
cardType: equipableItem
name: CUI00016
level: 2
types: Wind, Katana

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {attack += 300, attack += 100 if types = Samurai}