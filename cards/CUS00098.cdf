id: CUS00098
cardType: continuousSpell
name: CUS00098
level: 1
types: Dragon

o: trigger
mandatory: no
condition: thisCard.zone = field
after: COUNT(destroyed(dueTo: fights, by: types = Dragon & owner = you)) > 0
DAMAGE(opponent, 100);
