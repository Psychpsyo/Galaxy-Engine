id: CUS00248
cardType: standardSpell
name: CUS00248
level: 0
types: Ice

o: cast
condition: you.partner.types = Ice & you.partner.cardType = unit
cost:
$card = SELECT(1, [from discard]);
exec:
EXILE([from discard where self = $card]);

o: trigger
mandatory: no
after: discarded(from: hand) = thisCard
cost:
EXILE(SELECT(1, [from you.discard where types = Ice & self != thisCard]));
exec:
MOVE(SELECT(1, [from you.deck where name = CUS00248]), you.hand);