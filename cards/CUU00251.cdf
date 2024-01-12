id: CUU00251
cardType: unit
name: CUU00251
level: 5
types: Fire, Machine, Figure
attack: 500
defense: 500

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
APPLY(thisCard, {level -= 1, attack, defense -= 100});
exec:
DISCARD?(opponent.DECKTOP?(2));

o: trigger
mandatory: no
condition: thisCard.zone = field
after: COUNT([from destroyed(dueTo: fight, by: thisCard) where cardType = unit]) > 0
opponent.DAMAGE(100);