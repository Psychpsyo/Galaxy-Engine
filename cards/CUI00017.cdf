id: CUI00017
cardType: equipableItem
name: CUI00017
level: 2
types: Earth
equipableTo: level > 4 & types = Earth

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {attack += 200}

o: trigger
mandatory: yes
after: COUNT([from destroyed(dueTo: fight, by: thisCard.equippedUnit) where cardType = unit]) > 0
opponent.DAMAGE(300);