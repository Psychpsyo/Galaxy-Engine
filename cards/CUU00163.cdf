id: CUU00163
cardType: unit
name: CUU00163
level: 0
types: Light, Angel, Machine, Curse
attack: 0
defense: 0

o: trigger
mandatory: yes
during: currentPhase = endPhase & COUNT([from currentTurn.destroyed where owner = you & level > 0 & types = Machine & types = Angel & cardType = unit]) > 0
condition: thisCard.zone = field
$moves = MOVE?(
	[from discard where
		owner = you &
		level > 0 &
		types = Machine &
		types = Angel &
		cardType = unit &
		self = currentTurn.destroyed
	],
	you.unitZone
);
LOSELIFE(SUM($moves.moved.level) * 100);