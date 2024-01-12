id: CUU00182
cardType: unit
name: CUU00182
level: 1
types: Light, Angel, Shield
attack: 0
defense: 100

o: trigger
mandatory: no
zoneDurationLimit: 1
after: declared.owner = opponent
condition: thisCard.zone = field
SETATTACKTARGET(thisCard);

o: trigger
mandatory: no
after: destroyed(dueTo: fight) = thisCard
GAINLIFE(100);