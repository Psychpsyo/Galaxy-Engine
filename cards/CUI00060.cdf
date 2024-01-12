id: CUI00060
cardType: continuousItem
name: CUI00060
level: 0
types: Dark, Rock

o: trigger
mandatory: no
turnLimit: 1
during: currentPhase = endPhase
condition: thisCard.zone = field
cost:
LOSELIFE(200);
exec:
DISCARD(thisCard);
SUMMON(SELECT(1, [from you.discard where cardType = unit]));