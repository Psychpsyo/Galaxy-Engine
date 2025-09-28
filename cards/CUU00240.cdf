id: CUU00240
cardType: unit
name: CUU00240
level: 1
types: Illusion, Ghost, Figure
attack: 0
defense: 100

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
$manaAmount = SELECTNUMBER(1~you.mana);
LOSEMANA($manaAmount);
exec:
opponent.may {
	$discarded = DISCARD(SELECT(1, [from own.deck where level > $manaAmount & cardType = unit]));
} then {
	SUMMONTOKENS(1, CUT00027,[from $discarded where cardType = unit].level, [Illusion, Ghost], 0, 0, no);
} else {
	APPLY(thisCard, {attack += $manaAmount * 200}, currentTurn.end);
};
