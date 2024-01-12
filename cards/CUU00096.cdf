id: CUU00096
cardType: unit
name: CUU00096
level: 7
types: Electric, Dragon
attack: 700
defense: 600

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand where types = Electric]));
exec:
APPLY([from opponent.field where cardType = unit], {defense -= 200}, endOfTurn);

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
DESTROY([from field where cardType = unit & defense = 0]);