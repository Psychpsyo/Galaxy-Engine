id: CUU00159
cardType: unit
name: CUU00159
level: 1
types: Fire, Beast
attack: 100
defense: 0

o: trigger
mandatory: yes
condition: thisCard.zone = field
after: COUNT([from destroyed(dueTo: fight, by: thisCard) where cardType = unit]) > 0
opponent.DAMAGE(100);

o: trigger
mandatory: yes
condition: discarded = thisCard
DISCARD?(opponent.DECKTOP?(2));