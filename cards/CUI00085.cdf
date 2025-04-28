id: CUI00085
cardType: equipableItem
name: CUI00085
level: 1
types: Dark
equipableTo: types = Demon

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {attack += 200}

o: trigger
mandatory: no
condition: thisCard.zone = field
after: COUNT($destroyed{[from destroyed(dueTo: fights, by: thisCard.equippedUnit) where cardType = unit]}) > 0
cost:
LOSELIFE(150);
exec:
EXILE(SELECT(1, [from discard where self = $destroyed & cardType = unit]));
