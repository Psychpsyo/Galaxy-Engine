id: CUS00018
cardType: continuousSpell
name: CUS00018
level: 0
types:

o: fast
turnLimit: 1
condition: thisCard.zone = field
cost:
$unit = SELECT(1, [from you.field where cardType = unit & types = you.partner.types & level = you.partner.level]);
exec:
SWAP(you.partner, [from $unit where cardType = unit]);