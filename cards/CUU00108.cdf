id: CUU00108
cardType: unit
name: CUU00108
level: 1
types: Earth, Plant, Psychic, Gravity
attack: 0
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
LOSEMANA(1);
exec:
EXILE(SELECT(1, [from you.hand]));
MOVE(SELECT(1, [from deck where types = Gravity & cardType = spell]), hand);

o: optional
turnLimit: 1
condition: thisCard.zone = field
$exiled = EXILE(SELECT([1, 2, 3], [from you.discard where types = Gravity]));
APPLY(thisCard, {attack += COUNT($exiled) * 100}, endOfTurn);