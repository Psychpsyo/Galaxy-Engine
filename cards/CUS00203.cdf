id: CUS00203
cardType: standardSpell
name: CUS00203
level: 1
types:

o: cast
condition: currentPhase = you.mainPhase
DISCARD(SELECT(1, [from field where cardType = equipableItem & types = Katana & equippedUnit.types = Samurai & equippedUnit.owner = you]));
$ability = SELECTABILITY([CUS00203:1:1, CUS00203:1:2]);
DOABILITY($ability);

|o: part
DESTROY(SELECT(1, [from opponent.hand], yes, yes));

|o: part
DESTROY(SELECT(1, [from opponent.field where cardType = [spell, item]]));