id: CUU00090
cardType: unit
name: CUU00090
level: 2
types: Electric, Light, Angel
attack: 200
defense: 100

o: static
applyTo: attackTarget
condition: thisCard.zone = field & currentBlock = fightBlock & attackers = thisCard
modifier: {canCounterattack = no}