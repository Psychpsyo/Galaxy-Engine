id: CUU00101
cardType: unit
name: CUU00101
level: 10
types: Earth, Myth
attack: 0
defense: 0

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {attack, defense += you.life}

o: static
condition: thisCard.zone = field
modifier: {prohibit destroyed(dueTo: effect, by: self != thisCard) = thisCard}

o: trigger
during: currentPhase = you.endPhase
mandatory: yes
condition: thisCard.zone = field
try {
	LOSELIFE(100);
} else {
	DISCARD(thisCard);
};