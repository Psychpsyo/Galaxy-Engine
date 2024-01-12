id: CUU00160
cardType: unit
name: CUU00160
level: 1
types: Illusion, Beast
attack: 100
defense: 0

o: optional
turnLimit: 1
condition: thisCard.zone = field
SUMMON(SELECT(1, [from you.hand where types = [Beast, Bird] & name != [from you.field where cardType = unit].name]));

o: trigger
mandatory: no
turnLimit: 1
after: chosenTarget.owner = you
condition: thisCard.zone = field
SETATTACKTARGET(SELECT(1, [from you.unitZone where types = [Beast, Bird] & self != thisCard]));