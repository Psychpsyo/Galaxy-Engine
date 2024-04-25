id: CUS00006
cardType: standardSpell
name: CUS00006
level: 2
types: Fire

o: cast
$discards = DISCARD?(DECKTOP?(4));
DAMAGE(opponent, COUNT([from $discards.discarded where types = Fire]));