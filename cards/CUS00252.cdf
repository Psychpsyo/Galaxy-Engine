id: CUS00252
cardType: standardSpell
name: CUS00252
level: 1
types: Psychic

o: cast
$unit = SELECT(1, [from you.unitZone where level <= 2 & types = Psychic & cardType = unit]);
APPLY($unit, {abilities += CUS00252:1:1}, currentTurn.end);

|o: static
condition: thisCard.zone = field
modifier: {cancel destroyed = [from you.field where self != thisCard & types = thisCard.types]}
mandatory: no
zoneDurationLimit: 1