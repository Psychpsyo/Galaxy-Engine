id: CUI00019
cardType: equipableItem
name: CUI00019
level: 4
types: Fire, Sword

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {attack += 400}

o: trigger
mandatory: yes
after: COUNT([from destroyed(dueTo: fight, by: [from thisCard.equippedUnit where types = Fire]) where cardType = unit]) > 0
DISCARD?(opponent.DECKTOP?(2));