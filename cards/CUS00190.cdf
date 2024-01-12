id: CUS00190
cardType: standardSpell
name: CUS00190
level: 0
types: Illusion

o: cast
condition: you.partner.types = Illusion & you.partner.cardType = unit
cost:
DISCARD(SELECT(1, [from you.hand where types = Illusion]));
exec:
APPLY(SELECT(1, [from opponent.field where cardType = unit & level < 4]), {cancelAbilities}, endOfTurn);