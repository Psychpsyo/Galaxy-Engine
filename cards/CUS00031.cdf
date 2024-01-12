id: CUS00031
cardType: standardSpell
name: CUS00031
level: 1
types:

o: cast
cost:
LOSELIFE(50);
exec:
$moved = MOVE(SELECT(1, [from you.deck where cardType = unit]), hand);
LOSELIFE($moved.level * 50);