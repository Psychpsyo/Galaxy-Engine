id: CUU00278
cardType: unit
name: CUU00278
level: 7
types: Illusion, Demon
attack: 700
defense: 600

o: trigger
mandatory: no
condition: thisCard.zone = field & COUNT([from you.field, you.hand where self != thisCard + you.partner]) = 0
after: COUNT([from destroyed(dueTo: fight, by: thisCard) where cardType = unit]) > 0
GIVEATTACK(thisCard);