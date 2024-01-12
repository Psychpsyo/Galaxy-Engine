id: CUI00035
cardType: equipableItem
name: CUI00035
level: 0
types: Earth, Katana

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {attack += 200}

o: trigger
mandatory: yes
during: currentPhase = endPhase
condition: thisCard.zone = field & thisCard.equippedUnit.types != Samurai
DESTROY(thisCard);