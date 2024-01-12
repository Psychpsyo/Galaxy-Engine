id: CUU00135
cardType: unit
name: CUU00135
level: 0
types: Dark, Mage, Curse
attack: 0
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field
$discarded = DISCARD(SELECT(1, [from you.hand where cardType = unit]));
SUMMON(SELECT(1, [from you.hand where types = $discarded.types & cardType = unit]));

o: optional
zoneDurationLimit: 1
condition: thisCard.zone = field
$exiled = EXILE(SELECT(any, [from you.discard where cardType = unit], DIFFERENT(name)));
APPLY(thisCard, {attack += COUNT($exiled) * 100}, endOfTurn);