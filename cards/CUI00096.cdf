id: CUI00096
cardType: equipableItem
name: CUI00096
level: 0
types: Psychic, Machine
equipableTo: types = Psychic

o: static
applyTo: thisCard.equippedUnit
condition: thisCard.zone = field
modifier: {attack, defense += 100}

o: trigger
mandatory: no
during: currentPhase = opponent.endPhase
condition: thisCard.zone = field
cost:
DISCARD(thisCard);
exec:
$spell = SELECT(1, [from you.deck where types = Psychic & cardType = spell]);
SHUFFLE($spell);
MOVE($spell, deckTop);