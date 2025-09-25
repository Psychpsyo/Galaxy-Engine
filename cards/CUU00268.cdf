id: CUU00268
cardType: unit
name: CUU00268
level: 2
types: Fire, Plant
attack: 0
defense: 200

o: trigger
mandatory: yes
after: $retired{retired(from: [deck, field]) = thisCard} | discarded(from: [deck, field]) = thisCard
if ($retired) {
	SUMMONTOKENS(2, CUT00028, 0, [Fire, Plant], 0, 0);
} else {
	SUMMONTOKENS(1, CUT00028, 0, [Fire, Plant], 0, 0);
};
DAMAGE(you, 100);
