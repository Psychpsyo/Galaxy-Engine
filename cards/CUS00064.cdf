id: CUS00064
cardType: continuousSpell
name: CUS00064
level: 1
types: Spirit, Boundary
condition: currentTurn = you.turn

o: cast
onComplete:
PUTCOUNTERS(thisCard, Protection, COUNT([from you.field where types = Spirit & cardType = unit]));

o: trigger
mandatory: yes
after: declared.owner = [you, opponent]
condition: thisCard.zone = field
REMOVECOUNTERS(thisCard, Protection, 1);
CANCELATTACK();
if (GETCOUNTERS(thisCard, Protection) = 0) {
	DISCARD(thisCard);
};
