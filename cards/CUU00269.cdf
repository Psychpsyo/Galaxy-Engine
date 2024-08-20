id: CUU00269
cardType: unit
name: CUU00269
level: 1
types: Dark, Demon
attack: 100
defense: 100

o: trigger
mandatory: yes
after: lifeLost(byPlayer: opponent, asCost: yes)
opponent.may {
	DISCARD(SELECT(1, [from own.hand]));
} else {
	opponent.LOSELIFE(50);
};
