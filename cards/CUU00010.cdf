id: CUU00010
cardType: unit
name: CUU00010
level: 8
types: Fire, Dragon, Myth
attack: 600
defense: 800

o: trigger
mandatory: yes
condition: thisCard.zone = field
after: COUNT([from destroyed(dueTo: fight, by: thisCard) where cardType = unit]) > 0
both.DISCARD?(DECKTOP?(4));

o: trigger
mandatory: no
after: destroyed = thisCard
MOVE(SELECT(1, [from you.deck where types = Sword]), you.hand);