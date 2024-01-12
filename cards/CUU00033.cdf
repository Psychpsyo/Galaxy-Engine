id: CUU00033
cardType: unit
name: CUU00033
level: 4
types: Earth, Rock, Structure
attack: 0
defense: 400

o: trigger
mandatory: no
after: declared.owner = opponent
condition: thisCard.zone = field
SETATTACKTARGET(thisCard);