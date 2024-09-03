id: CUI00026
cardType: equipableItem
name: CUI00026
level: 3
types: Sword, Myth

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {attack += 300}

o: trigger
mandatory: no
after: discarded(from: [you.deck, you.field]) = thisCard
MOVE([from discard where self = thisCard], baseOwner.deck);
EXILE(DECKTOP(opponent, 1));