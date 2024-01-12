id: CUS00226
cardType: standardSpell
name: CUS00226
level: 1
types: Fire, Katana

o: cast
condition: COUNT([from attackers where owner = you & types = Fire & types = Samurai & cardType = unit]) = 1 & COUNT(attackers) = 1
$exiled = EXILE(SELECT([1, 2, 3, 4], [from you.discard where types = Fire], DIFFERENT(name)));
$discarded = DISCARD?(opponent.DECKTOP?(COUNT($exiled)))
APPLY(attackers, {attack += COUNT($discarded) * 200}, endOfTurn);