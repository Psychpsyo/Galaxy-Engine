id: CUU00198
cardType: unit
name: CUU00198
level: 1
types: Dark, Fire, Ghost, Mage
attack: 0
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
LOSELIFE(100);
exec:
$viewed = both.VIEW(DECKTOP(you, 1));
if ($viewed.types = thisCard.types) {
	DISCARD($viewed);
	SUMMONTOKENS(1, CUT00020, 0, [Illusion, Light, Bug], 0, 0, you.field);
} else {
	MOVE($viewed, you.deckTop);
};

o: optional
turnLimit: 1
condition: thisCard.zone = field
$selected = SELECT(1, [from you.field where cardType = unit]);
$discarded = DISCARD([from you.field where name = $selected.name & self != $selected]);
APPLY($selected, {attack += COUNT($discarded) * 100}, currentTurn.end);