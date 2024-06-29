id: CUU00185
cardType: unit
name: CUU00185
level: 6
types: Ice, Water, Fish
attack: 600
defense: 400

o: static
applyTo: thisCard
condition: thisCard.zone = discard
modifier: {prohibit exiled = self}

o: trigger
mandatory: no
condition: thisCard.zone = field
after: destroyed = thisCard
cost:
LOSELIFE(200);
exec:
SUMMON(SELECT(1, [from you.hand where name = CUU00185]), no);