id: CUU00203
cardType: unit
name: CUU00203
level: 1
types: Dark, Demon
attack: 0
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field
opponent.may {
	LOSELIFE(200);
} then {
	opponent.DRAW(1);
} else {
	APPLY(thisCard, {level += 1, attack += 100}, currentTurn.end);
};