id: CUU00099
cardType: unit
name: CUU00099
level: 8
types: Light, Angel
attack: 500
defense: 800

o: optional
turnLimit: 1
condition: thisCard.zone = field
SUMMON(SELECT(1, [from you.hand where types = Light]));

o: static
applyTo: [from you.field where self != thisCard & types = Light]
condition: thisCard.zone = field
modifier: {attack += 100}