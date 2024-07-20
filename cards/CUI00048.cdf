id: CUI00048
cardType: continuousItem
name: CUI00048
level: 4
types: Fire, Book, Structure

o: optional
turnLimit: 1
condition: thisCard.zone = field
cost:
DISCARD(SELECT(1, [from you.hand]));
exec:
$viewed = both.VIEW(DECKTOP(you, 3));
$selected = SELECT(1, $viewed);
MOVE($selected, you.hand);
DISCARD($viewed - $selected);
DAMAGE(200);

o: trigger
mandatory: yes
after: discarded(from: field) = thisCard
MOVE([from you.discard where name != CUI00048], you.deck);
EXILE(thisCard);