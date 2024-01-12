id: CUU00082
cardType: unit
name: CUU00082
level: 1
types: Fire, Wind, Bird
attack: 100
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
$player = SELECTPLAYER();
exec:
DISCARD($player.DECKTOP(1));