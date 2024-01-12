id: CUS00170
cardType: standardSpell
name: CUS00170
level: 0
types:

o: cast
condition: currentPhase = you.battlePhase
$destroyed = DESTROY(SELECT(1, [from field where cardType = equipableItem & equippedUnit.types = Warrior & equippedUnit.attacksMade > 0]));
GIVEATTACK($destroyed.equippedUnit);