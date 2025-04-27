id: CUU00027
cardType: unit
name: CUU00027
level: 1
types: Fire, Mage
attack: 0
defense: 0

o: trigger
mandatory: yes
after: COUNT($cards{[from discarded(from: deck)]}) > 0
condition: thisCard.zone = field
GAINLIFE(COUNT([from $cards where owner = you]) * 50);
DAMAGE(opponent, COUNT([from $cards where owner = opponent]) * 50);