id: CUI00027
cardType: equipableItem
name: CUI00027
level: 2
types: Fire, Katana, Curse
equipableTo: zone = you.unitZone

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {attack += 100, attack += level * 50 if types = Samurai}

o: trigger
mandatory: yes
condition: thisCard.zone = field
after: COUNT($destroyed{destroyed(by: thisCard.equippedUnit, dueTo: fights)}) > 0
DAMAGE(opponent, [from $destroyed where cardType = unit].level * 50);

o: trigger
mandatory: yes
condition: thisCard.zone = field
during: currentPhase = you.endPhase
try {
	EXILE(SELECT(2, [from you.discard where cardType = unit]));
} else {
	DESTROY(thisCard.equippedUnit);
};
