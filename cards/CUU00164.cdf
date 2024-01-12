id: CUU00164
cardType: unit
name: CUU00164
level: 1
types: Light, Angel, Machine
attack: 0
defense: 100

o: trigger
mandatory: no
after: summoned(from: hand) = thisCard
MOVE(SELECT(1, [from you.deck where name = CUU00165]), hand);