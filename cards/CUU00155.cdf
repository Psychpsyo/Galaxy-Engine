id: CUU00155
cardType: unit
name: CUU00155
level: 3
types: Ice, Light, Samurai
attack: 300
defense: 200

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
LOSELIFE(100);
exec:
APPLY(SELECT(1, [from field where cardType = [spell, item]]), {cancelAbilities}, endOfOpponentNextTurn);