id: CUS00096
cardType: continuousSpell
name: CUS00096
level: 1
types: Ice
condition: currentTurn = you.turn

o: static
applyTo: [from field where types != Ice]
condition: thisCard.zone = field
modifier: {attack, defense -= 100}

o: trigger
during: currentPhase = you.endPhase
mandatory: yes
condition: thisCard.zone = field
you.try {
	EXILE(SELECT(1, [from you.discard where types = Ice]));
} else {
	DISCARD(thisCard);
};