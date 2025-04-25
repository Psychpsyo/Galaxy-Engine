id: CUU00243
cardType: unit
name: CUU00243
level: 6
types: Illusion, Ghost, Warrior
attack: 500
defense: 200

o: trigger
mandatory: yes
after: summoned = thisCard
cost:
$unit = SELECT(1, [from opponent.field where cardType = unit]);
exec:
APPLY($unit, {canAttack, canCounterattack = no}, currentTurn.end);

o: static
condition: thisCard.zone = field
modifier: {replace COUNT([from discarded(byDestroy: yes, dueTo: fights, by: thisCard) where cardType = unit]) > 0 with EXILE([from discarded(byDestroy: yes, dueTo: fights, by: thisCard) where cardType = unit])}
mandatory: yes
