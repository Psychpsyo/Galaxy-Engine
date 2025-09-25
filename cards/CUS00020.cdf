id: CUS00020
cardType: standardSpell
name: CUS00020
level: 0
types:

o: cast
after: $damage{damageDealt(to: you)} > 0
SUMMON(SELECT(any, [from you.hand], SUM(attack) < $damage));
DRAW(1);
