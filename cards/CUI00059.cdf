id: CUI00059
cardType: equipableItem
name: CUI00059
level: 8
types: Earth, Sword, Myth
equipableTo: types = Earth & owner = you

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {attack += 800}

o: static
condition: thisCard.zone = field
modifier: {replace COUNT([from discarded(byDestroy: yes, dueTo: fights, by: thisCard.equippedUnit) where cardType = unit]) > 0 with EXILE([from discarded(byDestroy: yes, dueTo: fights, by: thisCard.equippedUnit) where cardType = unit])}
mandatory: yes

o: trigger
mandatory: yes
after: COUNT([from destroyed(dueTo: fights, by: thisCard.equippedUnit) where cardType = unit]) > 0
DAMAGE(opponent, 200);
