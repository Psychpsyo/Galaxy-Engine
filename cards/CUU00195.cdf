id: CUU00195
cardType: unit
name: CUU00195
level: 11
types:
attack: 0
defense: 800

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {attack += COUNT([from exile]) * 100}

o: trigger
mandatory: yes
after: COUNT([from destroyed(dueTo: fight, by: thisCard) where cardType = unit]) > 0
EXILE?(opponent.DECKTOP?(5));

o: trigger
mandatory: no
after: destroyed(from: field) = thisCard & COUNT([from you.discard where name = CUS00176]) > 0
EXILE?(DECKTOP?(10));
MOVE([from discard where self = thisCard], field);