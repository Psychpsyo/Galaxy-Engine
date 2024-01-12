id: CUS00089
cardType: standardSpell
name: CUS00089
level: 2
types: Light, Landmine

o: cast
after: summoned.owner = opponent
APPLY([from opponent.field], {attack = 0}, endOfTurn);