id: CUS00180
cardType: standardSpell
name: CUS00180
level: 0
types:

o: cast
cost:
$selected = SELECT(any, [from you.unitZone where cardType = unit]);
exec:
$viewed = VIEW(DECKTOP(opponent, 1));
if ($viewed.level >= SUM($selected.level)) {
	GAINMANA(SUM($selected.level));
} else {
	EXILE($selected);
};
opponent.SHUFFLE();