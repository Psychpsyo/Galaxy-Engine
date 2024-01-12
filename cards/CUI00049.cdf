id: CUI00049
cardType: continuousItem
name: CUI00049
level: 1
types: Light

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
LOSELIFE(100);
exec:
$discarded = DISCARD(SELECT(1, [from you.field where types = Bug]));
SUMMON(SELECT(1, [from you.deck where level != $discarded.level & level < 5 & types = Bug]));