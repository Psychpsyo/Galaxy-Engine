id: CUU00055
cardType: unit
name: CUU00055
level: 3
types: Ice, Figure
attack: 300
defense: 200

o: static
applyTo: [from field where types != Ice & cardType = unit & currentTurn.summoned = self]
condition: thisCard.zone = field
modifier: {canAttack = no}

o: trigger
mandatory: yes
during: currentPhase = opponent.endPhase
condition: thisCard.zone = field
APPLY(thisCard, {attack, defense -= 100})