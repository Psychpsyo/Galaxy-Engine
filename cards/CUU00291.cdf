id: CUU00291
cardType: unit
name: CUU00291
level: 3
types: Dark, Water, Fish, Ghost, Curse
attack: 200
defense: 300

o: trigger
mandatory: no
after: summoned = thisCard
cost:
$card = SELECT(1, [from discard where level <= 2 & cardType = unit]);
exec:
MOVE([from discard where self = $card], baseOwner.deck);
GAINLIFE(100);

o: optional
turnLimit: 1
condition: thisCard.zone = field & COUNT([from you.discard where name = CUU00291]) >= 2
$unit = SELECT(1, [from you.field where types = Water & types = Ghost]);
APPLY($unit, {abilities += CUU00291:2:1}, currentTurn.end);

|o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {attackRights = 2}