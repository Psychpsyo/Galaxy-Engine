id: CUU00106
cardType: unit
name: CUU00106
level: 3
types: Light, Warrior, Ghost
attack: 0
defense: 300

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {attack += COUNT([from exile]) * 50}

o: trigger
mandatory: yes
condition: thisCard.zone = field
after: COUNT([from destroyed(dueTo: fights, by: thisCard) where cardType = unit]) > 0
EXILE(DECKTOP(opponent, 1));
