id: CUU00235
cardType: unit
name: CUU00235
level: 7
types: Illusion, Water, Beast, Ghost, Myth
attack: 0
defense: 500

o: trigger
mandatory: no
condition: thisCard.zone = field
after: summoned(from: discard) = thisCard
APPLY(thisCard, {attack += opponent.life})

o: trigger
mandatory: no
condition: thisCard.zone = field
after: COUNT([from destroyed(dueTo: fight, by: thisCard) where cardType = unit]) > 0
opponent.DAMAGE(COUNT([from you.discard where name = CUI00083]) * 100)