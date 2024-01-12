id: CUS00085
cardType: standardSpell
name: CUS00085
level: 0
types: Gravity

o: cast
after: COUNT([from declared]) = 1 & declared.owner = opponent & chosenTarget.types = declared.types
CANCELATTACK();