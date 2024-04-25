id: CUS00136
cardType: standardSpell
name: CUS00136
level: 1
types:

o: cast
cost:
LOSELIFE(100);
exec:
$choice = SELECT(3, [from you.deck where cardType = unit], SAME(level) & DIFFERENT(name));
$viewed = opponent.VIEW($choice);
$opponentChoice = opponent.SELECT(1, $viewed);
MOVE($opponentChoice, you.hand);
MOVE($choice - $opponentChoice, deck);