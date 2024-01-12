id: CUU00253
cardType: unit
name: CUU00253
level: 1
types: Machine, Mage
attack: 100
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
LOSEMANA(1);
exec:
MOVE(SELECT(1, [from you.deck where name = CUI00097]), hand);