id: CUU00144
cardType: unit
name: CUU00144
level: 1
types: Dark, Spirit
attack: 0
defense: 100

o: trigger
mandatory: no
turnLimit: 1
during: attackers.owner = opponent
condition: thisCard.zone = field
$viewed = both.VIEW(DECKTOP(you, 1));
if ($viewed.types = thisCard.types & viewed.cardType = unit) {
	CANCELATTACK();
};