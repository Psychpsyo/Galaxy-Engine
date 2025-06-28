id: CUS00262
cardType: standardSpell
name: CUS00262
level: 2
types: Illusion
deckLimit: 2

o: cast
condition: you.partner.level <= 2
after: COUNT(drawn(dueTo: effect, byPlayer: opponent)) > 0
cost:
LOSELIFE(100);
exec:
DAMAGE(opponent, COUNT([from opponent.discard where cardType = [spell, item]]) * 50);
