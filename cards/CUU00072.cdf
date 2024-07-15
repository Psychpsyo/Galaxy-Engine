id: CUU00072
cardType: unit
name: CUU00072
level: 1
types: Water, Fish
attack: 100
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
$viewed = VIEW(SELECT(1, [from opponent.hand], yes, yes));
if ($viewed.level <= thisCard.level) {
	DESTROY($viewed);
};