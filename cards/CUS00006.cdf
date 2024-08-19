id: CUS00006
cardType: standardSpell
name: CUS00006
level: 2
types: Fire

o: cast
$discarded = DISCARD?(DECKTOP?(4));
DAMAGE(opponent, COUNT([from $discarded where types = Fire]) * 50);