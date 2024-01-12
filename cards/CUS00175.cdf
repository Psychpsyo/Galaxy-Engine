id: CUS00175
cardType: standardSpell
name: CUS00175
level: 1
types:

o: cast
$exiled = EXILE(SELECT(1, [from discard where cardType = spell]));
EXILE([from opponent.hand, opponent.deck where cardType = spell & name = $exiled.name]);