id: CUI00101
cardType: standardItem
name: CUI00101
level: 0
types: Wind

o: deploy
condition: you.partner.types = Wind
$toReturn = SELECT(1, [from you.field where level <= 6 & types = Bird & cardType = unit]);
MOVE($toReturn, baseOwner.hand);
if (COUNT([from field where level < $toReturn.level]) > 0) {
	MOVE([from field where level < $toReturn.level], baseOwner.hand);
};