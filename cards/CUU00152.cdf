id: CUU00152
cardType: unit
name: CUU00152
level: 7
types: Light, Fire, Angel
attack: 200
defense: 700

o: optional
turnLimit: 1
condition: thisCard.zone = field
GAINLIFE(COUNT([from you.discard where types = thisCard.types]) * 50)

o: trigger
mandatory: no
after: discarded = thisCard
MOVE([from discard where self = thisCard], baseOwner.deckTop);