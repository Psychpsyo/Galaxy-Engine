id: CUU00255
cardType: unit
name: CUU00255
level: 1
types: Illusion, Rock, Figure, Curse
attack: 100
defense: 0

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {name += CUI00083}

o: trigger
mandatory: no
after: destroyed(dueTo: $fight{currentFight}) = thisCard
cost:
$selected = SELECT(1, [from $fight.participants where zone = unitZone & cardType = unit]);
exec:
if ($selected.types != Curse) {
	APPLY($selected, {types += Curse});
} else {
	APPLY($selected, {attack = 0});
};
