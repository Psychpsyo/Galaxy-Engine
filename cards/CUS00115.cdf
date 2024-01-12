id: CUS00115
cardType: continuousSpell
name: CUS00115
level: 1
types: Electric, Wind

o: fast
turnLimit: 1
condition: thisCard.zone = field
DISCARD(SELECT(1, [from you.hand where types = Electric]));
APPLY(SELECT(1, [from field where cardType = unit]), {attack, defense -= 100}, endOfTurn);