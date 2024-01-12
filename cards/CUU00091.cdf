id: CUU00091
cardType: unit
name: CUU00091
level: 3
types: Electric, Earth, Bug
attack: 300
defense: 300

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
DESTROY(SELECT(1, [from field where defense = 0]));

o: trigger
mandatory: yes
during: currentPhase = endPhase
condition: thisCard.zone = field
both.DAMAGE(50);