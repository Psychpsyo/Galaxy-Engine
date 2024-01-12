id: CUS00140
cardType: standardSpell
name: CUS00140
level: 6
types:

o: cast
$destroyed = DESTROY([from you.field]);
opponent.DAMAGE(COUNT($destroyed) * 100);