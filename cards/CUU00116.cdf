id: CUU00116
cardType: unit
name: CUU00116
level: 3
types: Dark, Beast, Curse
attack: 100
defense: 100

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {attack += COUNT([from field where name = CUU00107]) * 100}

o: trigger
mandatory: yes
after: destroyed = thisCard
SUMMON(SELECT(1, [from you.deck where name = CUU00107]));

o: static
applyTo: [from field where GETCOUNTERS(self, Weakness) > 0]
condition: thisCard.zone = field
modifier: {attack, defense -= GETCOUNTERS(self, Weakness) * 50}