id: CUI00037
cardType: standardItem
name: CUI00037
level: 0
types: Book
turnLimit: 1

o: deploy
$unit = SELECT(1, [from you.deck where level < 5 & cardType = unit]);
SHUFFLE($unit);
MOVE($unit, deckTop);