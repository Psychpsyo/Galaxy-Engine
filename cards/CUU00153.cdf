id: CUU00153
cardType: unit
name: CUU00153
level: 3
types: Water
attack: 0
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
LOSELIFE(200);
exec:
$destroyed = DESTROY(SELECT(1, [from field where level < thisCard.level & cardType = [spell, item]]));
APPLY(thisCard, {level += $destroyed.level});

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {defense += level * 50}