id: CUI00022
cardType: equipableItem
name: CUI00022
level: 1
types: Electric, Chain

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {attack += 100}

o: trigger
mandatory: no
after: COUNT([from destroyed(dueTo: fight, by: thisCard.equippedUnit) where cardType = unit]) > 0
DISCARD(thisCard);
DESTROY(SELECT(1, [from field where (cardType = unit & defense < 101) | (cardType = [spell, item])]));