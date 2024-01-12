id: CUU00256
cardType: unit
name: CUU00256
level: 3
types: Ice, Warrior
attack: 250
defense: 250

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand where types = Ice]));
exec:
SUMMON(SELECT(1, [from you.deck where name = CUU00121]));

o: trigger
mandatory: no
during: attackers = thisCard
condition: thisCard.zone = field
APPLY(thisCard, {attack += COUNT([from field where name = CUU00121]) * 250}, endOfTurn);