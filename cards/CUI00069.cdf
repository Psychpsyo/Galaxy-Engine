id: CUI00069
cardType: continuousItem
name: CUI00069
level: 0
types: Landmine

o: trigger
during: attackers.owner = opponent
condition: thisCard.zone = field
EXILE(thisCard);
CANCELATTACK();
opponent.DRAW(1);