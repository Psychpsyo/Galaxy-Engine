id: CUU00085
cardType: unit
name: CUU00085
level: 0
types: Light, Illusion, Bug
attack: 0
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
LOSEMANA(1);
exec:
SUMMONTOKENS(1, CUT00001, 0, [Illusion, Light, Bug], 0, 0, you.field);
LOSELIFE(100);