id: CUI00095
cardType: standardItem
name: CUI00095
level: 4
types: Earth, Myth

o: deploy
condition: you.life >= 2000
cost:
LOSELIFE(you.life / 2);
exec:
SUMMON(SELECT(1, [from you.deck, you.hand, you.discard where name = CUU00101]), no);
DESTROY([from field]);