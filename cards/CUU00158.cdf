id: CUU00158
cardType: unit
name: CUU00158
level: 9
types: Wind, Dragon, Warrior
attack: 800
defense: 700

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand where types = Wind]));
exec:
MOVE([from field where cardType = [spell, item]], baseOwner.hand);