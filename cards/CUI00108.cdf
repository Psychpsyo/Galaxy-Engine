id: CUI00108
cardType: standardItem
name: CUI00108
level: 0
types:

o: deploy
SUMMON(SELECT(1, [from you.hand, you.discard where name = [CUU00211, CUU00277]]));

o: trigger
mandatory: no
after: discarded(from: hand) = thisCard
MOVE(SELECT(1, [from you.deck where name = [CUU00211, CUU00277]]), hand);