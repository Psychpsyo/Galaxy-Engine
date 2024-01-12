id: CUU00165
cardType: unit
name: CUU00165
level: 2
types: Light, Angel, Machine
attack: 0
defense: 200

o: trigger
mandatory: no
after: summoned(from: hand) = thisCard
MOVE(SELECT(1, [from you.deck where name = CUU00166]), hand);