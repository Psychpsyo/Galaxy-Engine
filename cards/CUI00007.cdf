id: CUI00007
cardType: standardItem
name: CUI00007
level: 2
types: Light, Dark

o: deploy
$unit = SELECT(1, [from you.field where cardType = unit]);
SUMMON(SELECT(any, [from you.deck where name = $unit.name]));