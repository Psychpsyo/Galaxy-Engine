id: CUU00170
cardType: unit
name: CUU00170
level: 0
types: Water, Angel
attack: 0
defense: 0

o: trigger
mandatory: yes
after: COUNT([from destroyed where self != thisCard & owner = you]) > 0
APPLY(thisCard, {attack += 100}, endOfTurn);