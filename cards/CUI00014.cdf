id: CUI00014
cardType: equipableItem
name: CUI00014
level: 1
types: Earth, Shield
equipableTo: types = Earth

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {defense += 100}

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {replace destroyed = thisCard.equippedUnit with DESTROY(thisCard);}
mandatory: yes