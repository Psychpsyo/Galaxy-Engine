id: CUU00270
cardType: unit
name: CUU00270
level: 7
types: Water, Demon
attack: 700
defense: 500

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
$revealed = REVEAL(SELECT(any, [from you.hand where name = [CUS00044, CUI00042]]));
exec:
APPLY(thisCard, {attack += COUNT($revealed) * 100}, currentTurn.end);

o: trigger
mandatory: no
after: COUNT([from destroyed(dueTo: fights, by: thisCard) where cardType = unit]) > 0
condition: thisCard.zone = field
MOVE(SELECT(1, [from you.deck where name = [CUS00044, CUI00042]]), hand);

o: trigger
mandatory: yes
after: destroyed = thisCard
REVEAL([from you.hand]);
if ([from you.hand] = [CUS00044, CUI00042]) {
	MOVE([from you.hand where name = [CUS00044, CUI00042]], baseOwner.deck);
};
