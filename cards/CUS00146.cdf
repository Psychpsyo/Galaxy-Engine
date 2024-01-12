id: CUS00146
cardType: continuousSpell
name: CUS00146
level: 0
types:

o: fast
turnLimit: 1
condition: thisCard.zone = field
$unit = SELECT(1, [from you.field where currentTurn.summoned = self]);
SUMMON(SELECT(1, [from you.hand where cardType = unit & types = $unit.types]));