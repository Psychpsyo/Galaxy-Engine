id: CUS00193
cardType: continuousSpell
name: CUS00193
level: 1
types: Water

o: trigger
mandatory: no
after: COUNT($units{[from destroyed(from: you.field) where types = Water & COUNT(types) = 1 & cardType = unit]}) > 0
cost:
LOSELIFE(200);
exec:
$exiled = EXILE(SELECT(1, [from $units where cardType = unit]));
MOVE(SELECT(2+, [from you.deck where level >= 1 & types = Water & COUNT(types) = 1 & cardType = unit], SUM(level) = $exiled.level), you.field);
