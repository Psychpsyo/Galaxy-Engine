id: CUI00084
cardType: standardItem
name: CUI00084
level: 2
types: Illusion, Book
deckLimit: 1

o: deploy
condition: ARE(5+, [from you.discard], DIFFERENT(name))
DRAW(2);
EXILE(thisCard);