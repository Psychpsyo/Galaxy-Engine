id: CUI00119
cardType: standardItem
name: CUI00119
level: 1
types:
turnLimit: 1

o: deploy
$name = SELECTCARDNAME();
$viewed = VIEW([from opponent.hand]);
if (COUNT([from $viewed where name = $name]) > 0) {
	DESTROY([from $viewed where name = $name]);
};