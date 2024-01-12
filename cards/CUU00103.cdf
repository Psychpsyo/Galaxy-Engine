id: CUU00103
cardType: unit
name: CUU00103
level: 1
types: Ice, Spirit
attack: 0
defense: 100
deckLimit: any

o: fast
turnLimit: COUNT([from you.field where self != thisCard & cardType = unit & types = thisCard.types])
condition: thisCard.zone = field
APPLY(SELECT(1, [from field where cardType = [enchantSpell, continuousSpell, equipableItem, continuousItem]]), {cancelAbilities}, endOfTurn);