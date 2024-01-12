id: CUS00101
cardType: continuousSpell
name: CUS00101
level: 0
types: Sword, Katana

o: fast
turnLimit: 2
condition: thisCard.zone = field
EXILE(SELECT(1, [from you.discard where types = [Sword, Katana]]));
APPLY(SELECT(1, [from you.field where types = [Warrior, Samurai] & cardType = unit]), {attack += 200}, endOfTurn);