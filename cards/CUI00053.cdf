id: CUI00053
cardType: equipableItem
name: CUI00053
level: 4
types: Dark, Katana

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {attack += level * 100, attack += 300 if types = Samurai}