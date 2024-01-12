id: CUU00211
cardType: unit
name: CUU00211
level: 3
types: Light, Machine, Warrior
attack: 300
defense: 200

o: trigger
mandatory: no
after: summoned(from: hand) = thisCard
cost:
LOSELIFE(200);
exec:
APPLY(thisCard, {abilities += CUU00211:1:1}, endOfNextTurn)

[o: static
applyTo: [from field where cardType = unit & level < 3]
condition: thisCard.zone = field
modifier: {canAttack = no}