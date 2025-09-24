id: CUU00300
cardType: unit
name: CUU00300
level: 3
types: Illusion, Beast, Mage, Ghost, Myth
attack: 100
defense: 100

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {attack, defense += COUNT([from you.spellItemZone where name = CUI00083]) * 200}

o: trigger
mandatory: no
after: discarded(from: field) = thisCard
MOVE(SELECT(1, [from you.deck where level >= 7 & types = Ghost & types = Myth & cardType = unit]), hand);