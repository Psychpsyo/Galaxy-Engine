id: CUU00187
cardType: unit
name: CUU00187
level: 3
types: Fire, Beast, Machine
attack: 300
defense: 300

o: trigger
mandatory: no
condition: thisCard.zone = field
after: COUNT([from destroyed(dueTo: fight, by: thisCard) where cardType = unit]) > 0
$discarded = DISCARD(DECKTOP(1));
if (discarded.types = thisCard.types) {
	DAMAGE(opponent, 100);
};