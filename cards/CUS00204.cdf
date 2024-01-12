id: CUS00204
cardType: standardSpell
name: CUS00204
level: 0
types:

o: cast
$exiled = EXILE(SELECT(1, [from discard where types = Demon & cardType = unit]));
APPLY(SELECT(1, [from you.field where types = Mage & cardType = unit]), {abilities += $exiled.abilities}, endOfTurn);