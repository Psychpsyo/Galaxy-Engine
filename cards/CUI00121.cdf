id: CUI00121
cardType: standardItem
name: CUI00121
level: 0
types: Psychic

o: deploy
$unit = SELECT(1, [from you.discard where level <= 2 & types = Psychic & cardType = unit]);
MOVE(SELECT(1, [from you.deck where (name != $unit.name & level <= 2 & types = Psychic & cardType = unit) | name = CUU00262]), hand);
MOVE([from discard where self = $unit], baseOwner.hand);