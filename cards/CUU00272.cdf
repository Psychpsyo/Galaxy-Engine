id: CUU00272
cardType: unit
name: CUU00272
level: 2
types: Illusion, Psychic
attack: 100
defense: 200

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
EXILE(you.DECKTOP(1));
exec:
both.VIEW(opponent.DECKTOP(1));

o: optional
zoneDurationLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand where types = Psychic]));
exec:
MOVE(SELECT(1, [from you.deck where name = CUS00214]), hand);