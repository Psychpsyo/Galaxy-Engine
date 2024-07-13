id: CUS00053
cardType: continuousSpell
name: CUS00053
level: 1
types: Earth, Boundary

o: static
applyTo: [from field where types = Earth]
condition: thisCard.zone = field
modifier: {defense += 100}

o: trigger
during: currentPhase = you.drawPhase
mandatory: yes
condition: thisCard.zone = field
try {
	LOSEMANA(COUNT([from you.unitZone where types = Earth & cardType = unit]));
} else {
	DISCARD(thisCard);
};