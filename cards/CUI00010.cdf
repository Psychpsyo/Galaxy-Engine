id: CUI00010
cardType: equipableItem
name: CUI00010
level: 1
types: Light, Sword

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {attack += 100}

o: trigger
mandatory: yes
after: destroyed = thisCard
DRAW(1);