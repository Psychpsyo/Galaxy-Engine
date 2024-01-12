id: CUI00011
cardType: equipableItem
name: CUI00011
level: 1
types: Armor

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {defense += 200}

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {canAttack = no}