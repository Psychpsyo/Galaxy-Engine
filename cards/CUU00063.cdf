id: CUU00063
cardType: unit
name: CUU00063
level: 4
types: Fire, Beast
attack: 200
defense: 600

o: trigger
mandatory: yes
during: currentPhase = endPhase
condition: thisCard.zone = field
DAMAGE(100);