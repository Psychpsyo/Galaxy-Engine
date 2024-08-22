id: CUU00204
cardType: unit
name: CUU00204
level: 9
types: Illusion, Demon, Myth
attack: 900
defense: 800

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {attackRights = 3}

o: trigger
after: declared = thisCard
condition: thisCard.zone = field
forPlayer: opponent
cost:
LOSELIFE(200);
exec:
CANCELATTACK();

o: trigger
mandatory: yes
during: currentPhase = endPhase
condition: thisCard.zone = field
try {
	LOSELIFE(200);
} else {
	LOSELIFE(you.life);
};