id: CUI00079
cardType: equipableItem
name: CUI00079
level: 5
types: Light, Shield
equipableTo: types = [Warrior, Spirit]

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {defense += 300}

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {replace destroyed = thisCard.equippedUnit with DESTROY(thisCard);}
mandatory: yes