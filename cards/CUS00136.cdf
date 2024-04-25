id: CUS00136
cardType: standardSpell
name: CUS00136
level: 1
types:

o: cast
cost:
LOSELIFE(100);
exec:
<<<<<<< HEAD
$choice = SELECT(3, [from you.deck where cardType = unit], SAME(level) & DIFFERENT(name));
$viewed = opponent.VIEW($choice);
$opponentChoice = opponent.SELECT(1, $viewed);
MOVE($opponentChoice, you.hand);
MOVE($choice - $opponentChoice, deck);
=======
$units = SELECT(3, [from you.deck where cardType = unit], SAME(level) & DIFFERENT(name));
$choice = opponent.SELECT(1, VIEW($units));
MOVE($choice, you.hand);
MOVE($units - $choice, deck);
>>>>>>> 047a9f37339a5f4e81fd5089e8707522f0cd52e9
