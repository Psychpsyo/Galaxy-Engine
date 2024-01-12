id: CUU00059
cardType: unit
name: CUU00059
level: 4
types: Light, Warrior
attack: 400
defense: 300

o: static
applyTo: thisCard
condition: thisCard.zone = field & thisCard.fightingAgainst.types = Dark
modifier: {attack, defense += 300}