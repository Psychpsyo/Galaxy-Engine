id: CUU00221
cardType: unit
name: CUU00221
level: 2
types: Fire, Mage, Warrior
attack: 200
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand where types = Fire]));
exec:
$viewed = VIEW(SELECT(1, [from opponent.hand], yes, yes));
if ($viewed.cardType = unit) {
	DESTROY($viewed);
} else {
	DAMAGE(you, 100);
};

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
DISCARD?(DECKTOP?(opponent, 2));