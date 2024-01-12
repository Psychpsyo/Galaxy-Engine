id: CUU00143
cardType: unit
name: CUU00143
level: 6
types: Light, Spirit
attack: 200
defense: 500

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {cancel destroyed(dueTo: fight) = self}
mandatory: no
zoneDurationLimit: 1

o: trigger
mandatory: no
during: attackers.owner = opponent
condition: thisCard.zone = field
SETATTACKTARGET(thisCard);