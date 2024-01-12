id: CUS00082
cardType: continuousSpell
name: CUS00082
level: 3
types: Dark, Water, Wind, Curse
condition: currentTurn = you.turn

o: trigger
mandatory: yes
during: currentPhase = endPhase
condition: thisCard.zone = field
PUTCOUNTERS([from unitZone where types != Curse & cardType = unit], Weakness, 1);

o: static
applyTo: [from field where cardType = unit]
condition: thisCard.zone = field
modifier: {attack, defense -= GETCOUNTERS(self, Weakness) * 50}