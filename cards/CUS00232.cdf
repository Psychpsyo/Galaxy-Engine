id: CUS00232
cardType: standardSpell
name: CUS00232
level: 1
types: Dragon

o: cast
cost:
$unit = SELECT(1, [from you.field where level <= 7 & types = Dragon & cardType = unit]);
exec:
EXILE(SELECT(2, [from you.discard where level <= 3 & types = Dragon & cardType = unit], DIFFERENT(name)));
APPLY([from $unit where cardType = unit], {abilities += [CUS00232:1:1, CUS00232:1:2]}, currentTurn.end);

|o: static
condition: thisCard.zone = field
modifier: {cancel destroyed = thisCard}
mandatory: no
zoneDurationLimit: 1

|o: static
applyTo: [from fights where participants = thisCard]
condition: thisCard.zone = field
modifier: {opponentLifeDamage = 0}