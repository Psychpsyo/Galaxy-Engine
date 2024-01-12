id: CUU00131
cardType: unit
name: CUU00131
level: 6
types: Earth, Wind, Rock, Dragon
attack: 500
defense: 600

o: trigger
mandatory: no
after: declared.owner = opponent
condition: thisCard.zone = field
SETATTACKTARGET(thisCard);