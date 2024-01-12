id: CUS00081
cardType: standardSpell
name: CUS00081
level: 0
types: Electric

o: cast
APPLY(SELECT(1, [from field where cardType = [enchantSpell, continuousSpell, equipableItem, continuousItem]]), {cancelAbilities}, endOfTurn);