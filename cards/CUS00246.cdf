id: CUS00246
cardType: standardSpell
name: CUS00246
level: 2
types: Ghost, Landmine

o: cast
condition: currentTurn = opponent.turn
after: COUNT(summoned(byPlayer: opponent)) > 0
$summoned = SUMMON(SELECT(1, [from you.discard where defense != 0 & level <= 8 & types = Ghost & cardType = unit]), no);
DAMAGE(you, $summoned.defense);