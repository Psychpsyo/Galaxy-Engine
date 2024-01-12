id: CUU00166
cardType: unit
name: CUU00166
level: 3
types: Light, Angel, Machine
attack: 100
defense: 200

o: trigger
mandatory: no
after: summoned(from: hand) = thisCard
MOVE(SELECT(1, [from you.deck where name = CUU00164]), hand);