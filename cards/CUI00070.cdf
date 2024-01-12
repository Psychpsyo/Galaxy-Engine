id: CUI00070
cardType: equipableItem
name: CUI00070
level: 1
types: Dark, Sword, Myth

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {attack += 100, attack += 100 if types = Warrior}

o: optional
condition: thisCard.zone = field & thisCard.equippedUnit.owner = you & thisCard.equippedUnit.types = Warrior
cost:
DISCARD(thisCard);
exec:
APPLY(SELECT(1, [from unitZone where types = Dragon]), {attack, defense = 0});