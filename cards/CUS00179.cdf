id: CUS00179
cardType: standardSpell
name: CUS00179
level: 0
types:
condition: COUNT([from you.discard where level > 5 & types = Mage & cardType = unit]) > 0

o: cast
cost:
EXILE(SELECT(3, [from you.discard where types = Book & cardType = item], DIFFERENT(name)));
exec:
APPLY(SELECT(1, [from field where level = 0 & types = Mage & cardType = unit]), {abilities += CUS00119:1:1}, endOfTurn);

[o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {attack += COUNT([from exile]) * 100}