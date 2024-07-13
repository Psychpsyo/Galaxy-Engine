id: CUU00279
cardType: unit
name: CUU00279
level: 6
types: Dark, Demon
attack: 600
defense: 500

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
SUMMON(SELECT(1, [from you.deck where name = [CUU00203, CUU00269]]));

o: trigger
mandatory: no
condition: thisCard.zone = field
after: COUNT([from destroyed(dueTo: fight, by: thisCard) where cardType = unit]) > 0
opponent.may {
	LOSELIFE(100);
} then {
	you.may {
		MOVE(SELECT(1, [from you.deck, you.discard where name = CUS00227]), hand);
	};
} else {
	DESTROY([from you.field where cardType = unit]);
};