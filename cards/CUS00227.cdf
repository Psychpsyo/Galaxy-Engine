id: CUS00227
cardType: standardSpell
name: CUS00227
level: 0
types: Demon

o: cast
after: COUNT([from destroyed(from: you.field) where types = Demon & cardType = unit]) >= 2 & SUM([from destroyed(from: you.field) where types = Demon & cardType = unit].level) >= 8
SUMMON(SELECT(1, [from you.hand, you.deck, you.discard where name = CUU00204]), no);