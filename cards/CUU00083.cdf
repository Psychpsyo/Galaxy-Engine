id: CUU00083
cardType: unit
name: CUU00083
level: 3
types: Fire, Demon, Samurai
attack: 300
defense: 200

o: trigger
mandatory: yes
condition: thisCard.zone = field
after: COUNT([from destroyed(dueTo: fight, by: thisCard) where cardType = unit]) > 0
DISCARD?(opponent.DECKTOP?(2));

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
APPLY(thisCard, {attack += 100}, endOfTurn);