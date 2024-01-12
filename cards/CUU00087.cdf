id: CUU00087
cardType: unit
name: CUU00087
level: 2
types: Dark, Bird, Curse
attack: 0
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
$card = SELECT(1, [from field where types = Curse]);
exec:
MOVE(thisCard, baseOwner.deck);
DESTROY($card);

o: trigger
mandatory: yes
during: currentPhase = you.endPhase
condition: thisCard.zone = field
APPLY(SELECT(1, [from field]), {types += Curse});