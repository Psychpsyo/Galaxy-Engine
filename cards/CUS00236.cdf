id: CUS00236
cardType: standardSpell
name: CUS00236
level: 0
types: Earth

o: cast
APPLY(SELECT(1, [from you.field where types = Earth & cardType = unit]), {defense += 100}, currentTurn.end);

o: static
condition: thisCard.zone = discard & you.partner.name = [CUU00029, CUU00260]
modifier: {cancel destroyed = [from you.field where types = Earth & cardType = unit & defense >= 500]}
mandatory: no
gameLimit: 1