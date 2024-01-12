id: CUS00025
cardType: standardSpell
name: CUS00025
level: 0
types: Gravity

o: cast
condition: attackers.owner = opponent
cost:
$unit = SELECT(1, [from you.field where cardType = unit & self != attackTarget]);
exec:
SETATTACKTARGET($unit);