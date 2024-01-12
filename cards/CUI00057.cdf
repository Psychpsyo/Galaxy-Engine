id: CUI00057
cardType: equipableItem
name: CUI00057
level: 1
types: Light

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
LOSELIFE(100);
exec:
APPLY(SELECT(1, [from field where cardType = [spell, item]]), {cancelAbilities}, endOfTurn);