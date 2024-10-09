id: CUI00120
cardType: continuousItem
name: CUI00120
level: 0
types: Light

o: static
applyTo: [from you.field where types = Light & types = [Mage, Warrior]]
condition: thisCard.zone = field
modifier: {attack += 100}

o: static
applyTo: [from field where types = Dark]
condition: thisCard.zone = field
modifier: {attack, defense -= 100}

o: static
condition: thisCard.zone = field & COUNT([from you.field where name = CUI00102]) > 0
modifier: {prohibit destroyed(dueTo: effect) = [from you.field where (types = Light & types = [Mage, Warrior]) | name = CUI00102]}