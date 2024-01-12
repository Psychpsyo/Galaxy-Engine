id: CUU00239
cardType: unit
name: CUU00239
level: 2
types: Illusion, Demon, Bug
attack: 100
defense: 0

o: trigger
mandatory: no
condition: thisCard.zone = field
after: COUNT([from destroyed(dueTo: fight, by: thisCard) where cardType = unit]) > 0
$moved = MOVE(SELECT(1, [from opponent.exile where cardType = unit]), baseOwner.deck);
opponent.DAMAGE($moved.level * 50);

o: trigger
mandatory: no
after: exiled = thisCard
APPLY(SELECT(1, [from you.field where cardType = unit]), {attack += 200}, endOfTurn);