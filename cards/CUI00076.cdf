id: CUI00076
cardType: standardItem
name: CUI00076
level: 1
types: Light, Earth, Plant

o: deploy
condition: COUNT([from you.unitZone]) = 0
SUMMONTOKENS(1, CUT00023, 0, [Light, Earth, Plant], 0, 0, CUI00076:1:1);

[o: trigger
during: currentPhase = endPhase
condition: thisCard.defense < 500
mandatory: yes
GAINLIFE(50);
APPLY(thisCard, {level += 1, defense += 100});