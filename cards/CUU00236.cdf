id: CUU00236
cardType: unit
name: CUU00236
level: 2
types: Fire, Dragon, Samurai
attack: 200
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand where types = Fire]));
exec:
APPLY(thisCard, {attackRights = 2}, endOfTurn);

o: trigger
mandatory: no
condition: thisCard.zone = field
after: COUNT([from destroyed(dueTo: fight, by: thisCard) where cardType = unit]) > 0
DISCARD?(opponent.DECKTOP?(2));