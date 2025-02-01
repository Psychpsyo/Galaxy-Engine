id: CUS00070
cardType: standardSpell
name: CUS00070
level: 1
types: Book

o: cast
$name = SELECTCARDNAME();
$viewed = VIEW(DECKTOP(you, 3));
if ($viewed.name = $name) {
	$shown = both.VIEW(SELECT(1, [from $viewed where name = $name]));
	MOVE($shown, you.hand);
	MOVE(ORDER($viewed - $shown), you.deckTop);
} else {
	MOVE(ORDER($viewed), you.deckTop);
};