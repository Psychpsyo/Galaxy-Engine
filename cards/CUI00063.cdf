id: CUI00063
cardType: equipableItem
name: CUI00063
level: 1
types: Electric, Katana

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {attack += 100, attack += 100 if types = Samurai}

o: optional
turnLimit: 2
condition: thisCard.zone = field
EXILE(SELECT(1, [from you.discard where cardType = spell]));
APPLY(thisCard.equippedUnit, {attack += 100}, endOfTurn);