id: CUS00245
cardType: enchantSpell
name: CUS00245
level: 0
types: Dark

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {types += Dark}

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field & thisCard.equippedUnit.baseTypes = Dark
modifier: {attack, defense -= 300}

o: fast
turnLimit: 1
condition: thisCard.zone = field & thisCard.equippedUnit.types = Dark & thisCard.equippedUnit.types = Mage
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
GAINMANA(2);