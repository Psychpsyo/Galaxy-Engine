id: CUU00196
cardType: unit
name: CUU00196
level: 0
types: Earth, Ghost
attack: 0
defense: 0

o: trigger
globalTurnLimit: 1
mandatory: no
after: discarded = thisCard
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
SUMMON(SELECT(1, [from you.deck where name = CUU00196]));