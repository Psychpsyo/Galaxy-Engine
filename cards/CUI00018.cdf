id: CUI00018
cardType: equipableItem
name: CUI00018
level: 3
types: Shield, Curse

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {defense -= 300}

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {abilities += CUI00018:2:1}

[o: trigger
turnLimit: 1
mandatory: yes
after: targeted = thisCard
condition: thisCard.zone = field
APPLY(attackers, {attack = 0});