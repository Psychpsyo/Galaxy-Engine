id: CUS00046
cardType: standardSpell
name: CUS00046
level: 10
types: Dark

o: cast
$destroyed = DESTROY([from opponent.field where cardType = unit]);
DAMAGE(opponent, SUM($destroyed.level) * 50);