id: CUS00198
cardType: standardSpell
name: CUS00198
level: 0
types:

o: cast
condition: SUM([from opponent.field where cardType = unit].level) > SUM([from you.field where cardType = unit].level) & attackers.owner = opponent
SUMMON(SELECT(1, [from you.hand where level < 5 & types = Warrior & cardType = unit]));
CANCELATTACK();
DRAW(1);