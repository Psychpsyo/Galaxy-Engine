id: CUU00086
cardType: unit
name: CUU00086
level: 1
types: Earth, Rock
attack: 0
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field
$discarded = DISCARD(SELECT(1, [from you.hand where cardType = item & COUNT(types) > 0]));
MOVE(SELECT(1, [from you.deck where level <= 4 & cardType = [equipableItem, continuousItem] & types != $discarded.types]), hand);