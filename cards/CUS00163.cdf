id: CUS00163
cardType: standardSpell
name: CUS00163
level: 3
types:

o: cast
cost:
LOSELIFE(200);
exec:
$discarded = DISCARD(SELECT(1, [from you.deck where level <= 6 & types = Dark & cardType = unit]));
if (COUNT([from opponent.hand, opponent.deck where level > $discarded.level & cardType = unit]) > 0) {
	opponent.DISCARD(SELECT(1, [from opponent.hand, opponent.deck where level > $discarded.level & cardType = unit]));
};