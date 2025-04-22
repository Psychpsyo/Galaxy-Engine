id: CUU00228
cardType: unit
name: CUU00228
level: 5
types: Dark, Bug, Curse
attack: 0
defense: 400

o: trigger
mandatory: yes
during: currentPhase = opponent.endPhase
condition: thisCard.zone = field
PUTCOUNTERS(thisCard, Emergence, 1);

o: optional
turnLimit: 1
condition: thisCard.zone = field
DESTROY(thisCard);

o: trigger
mandatory: no
after: $amount{GETCOUNTERS([from destroyed where self = thisCard], Emergence)} >= 2
cost:
EXILE([from discard where self = thisCard]);
exec:
$placed = MOVE(SELECT(1, [from you.hand, you.deck where name = CUU00148]), you.field);
if ($amount >= 3) {
	APPLY($placed, {abilities += [CUU00228:3:1, CUU00228:3:2]});
} else {
	$ability = SELECTABILITY([CUU00228:3:1, CUU00228:3:2]);
	APPLY($placed, {abilities += $ability});
};

|o: static
applyTo: thisCard
modifier: {attackRights = 2}

|o: static
modifier: {prohibit destroyed(dueTo: effect, by: self != thisCard) = thisCard}
