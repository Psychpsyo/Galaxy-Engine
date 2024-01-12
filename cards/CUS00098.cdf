id: CUS00098
cardType: continuousSpell
name: CUS00098
level: 1
types: Gravity

o: trigger
mandatory: no
condition: thisCard.zone = field
after: COUNT(destroyed(dueTo: fight, by: types = Dragon & owner = you)) > 0
opponent.DAMAGE(100);