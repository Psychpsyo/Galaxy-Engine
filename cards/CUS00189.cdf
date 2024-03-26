id: CUS00189
cardType: standardSpell
name: CUS00189
level: 2
types: Curse

o: cast
EXILE(SELECT(1, [from field where level <= 7 & cardType = unit & GETCOUNTERS(self, Weakness) >= 3]));