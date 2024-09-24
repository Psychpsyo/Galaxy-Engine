id: CUS00099
cardType: standardSpell
name: CUS00099
level: 0
types:
deckLimit: 1

o: cast
cost:
DISCARD(SELECT(4, [from you.hand]));
exec:
DESTROY([from field]);