id: CUS00136
cardType: standardSpell
name: CUS00136
level: 1
types:

o: cast
cost:
LOSELIFE(100);
exec:
$units = SELECT(3, [from you.deck where cardType = unit], SAME(level) & DIFFERENT(name));
$choice = opponent.SELECT(1, VIEW($units));
MOVE($choice, you.hand);
MOVE($units - $choice, deck);