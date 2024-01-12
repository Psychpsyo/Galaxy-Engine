id: CUU00246
cardType: unit
name: CUU00246
level: 3
types: Water, Demon, Psychic
attack: 250
defense: 250

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
$player = SELECTPLAYER();
exec:
$views = both.VIEW($player.DECKTOP(1));
MOVE($views.viewed, SELECTDECKSIDE($player));