id: CUS00247
cardType: standardSpell
name: CUS00247
level: 0
types: Ice

o: cast
after: COUNT([from retired(byPlayer: you) where types = Ice]) > 0
SUMMON(SELECT(1, [from you.deck where level >= 5 & defense <= 500]));

o: trigger
mandatory: no
after: exiled(from: discard) = thisCard
condition: you.partner.types = Ice & you.partner.cardType = unit
cost:
LOSELIFE(100);
exec:
MOVE([from exile where self = thisCard], baseOwner.hand);