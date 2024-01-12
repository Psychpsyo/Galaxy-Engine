id: CUU00283
cardType: unit
name: CUU00283
level: 7
types: Light, Dragon, Rock, Figure
attack: 0
defense: 700

o: static
applyTo: thisCard
condition: thisCard.zone = field & COUNT([from you.field, you.discard where types = Book]) > 2
modifier: {attack += 800}

o: static
applyTo: thisCard
condition: thisCard.zone = field
modifier: {attack, defense unaffectedBy self != thisCard}

o: optional
turnLimit: 1
condition: thisCard.zone = field & COUNT([from you.field where types = Book & cardType = item]) > 0
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
EXILE(SELECT(1, [from opponent.field where level < 5 & cardType = [spell, item]]));
opponent.DAMAGE(100);