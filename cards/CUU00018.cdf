id: CUU00018
cardType: unit
name: CUU00018
level: 7
types: Fire, Dragon
attack: 700
defense: 600

o: trigger
mandatory: yes
condition: thisCard.zone = field
after: COUNT([from destroyed(dueTo: fight, by: thisCard) where cardType = unit]) > 0
opponent.DAMAGE(200);