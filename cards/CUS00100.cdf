id: CUS00100
cardType: continuousSpell
name: CUS00100
level: 3
types: Light, Fire, Structure

o: static
applyTo: [from field where types = Plant & cardType = unit]
condition: thisCard.zone = field
modifier: {attack, defense += 100, level += 1 if zone != partnerZone}