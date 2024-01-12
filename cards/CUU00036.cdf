id: CUU00036
cardType: unit
name: CUU00036
level: 5
types: Light, Earth, Plant
attack: 0
defense: 500

o: optional
turnLimit: 1
condition: thisCard.zone = field
$views = opponent.VIEW(you.SELECT(any, [from you.hand where types = Light & cardType = unit]));
GAINLIFE(COUNT($views.viewed) * 50);