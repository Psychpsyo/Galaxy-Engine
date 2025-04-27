id: CUU00127
cardType: unit
name: CUU00127
level: 0
types: Wind, Light, Angel
attack: 0
defense: 0

o: trigger
mandatory: no
after: COUNT($added{[from moved(by: self != thisCard, dueTo: effect, from: deck, to: you.hand) where types = thisCard.types & cardType = unit]}) > 0
condition: thisCard.zone = field
cost:
$revealed = REVEAL(SELECT(1, $added));
exec:
SUMMON([from $revealed where cardType = unit]);
