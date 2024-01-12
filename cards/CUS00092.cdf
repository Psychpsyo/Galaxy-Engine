id: CUS00092
cardType: continuousSpell
name: CUS00092
level: 0
types:

o: trigger
mandatory: yes
after: COUNT([from summoned, cast, deployed]) > 0
condition: thisCard.zone = field
both.SHUFFLE();
PUTCOUNTERS(thisCard, Chaos, 1);

o: trigger
mandatory: yes
during: currentPhase = endPhase
condition: GETCOUNTERS(thisCard, Chaos) > 5
REMOVECOUNTERS(thisCard, Chaos, GETCOUNTERS(thisCard, Chaos));
$cards = both.MOVE([from own.hand], deck);
both.DRAW(COUNT($cards.moved));