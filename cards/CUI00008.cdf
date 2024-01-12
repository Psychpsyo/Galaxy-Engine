id: CUI00008
cardType: equipableItem
name: CUI00008
level: 1
types: Figure

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {replace destroyed = thisCard.equippedUnit with DESTROY(thisCard);}
mandatory: yes