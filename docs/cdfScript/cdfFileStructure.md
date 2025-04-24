# CDF File Structure

At its core, a card description file is a list of `property: value` definitions, like so:
```cdf
level: 9
types: Light, Dragon, Machine
attack: 900
defense: 900
```

## Card Properties
A card can have the following properties:

### id
The card ID, formatted like so:  
`id: CUU00161`

This is required on all cards.


### cardType
The type of card that this is, written like so:  
`cardType: unit`

This is required on all cards.

It can have any of the following values:  
- unit
- standardSpell
- continuousSpell
- enchantSpell
- standardItem
- continuousItem
- equipableItem


### name
The card's name, given as its ID, like so:  
`id: CUU00161`

This is required on all cards.

In most cases, this will be identical to the `id`.  
The two are separate to account for multiple cards with different IDs that share the same name, such as all four `Illusion Soldier Token`.  
In those cases, the lowest ID should be chosen to represent the name.


### level
The card's level, written like so:  
`level: 9`

This is required on all cards.

> **_Note:_**  
> There is no way to indicate a level of `?` since this only appears on tokens for which the level should be determined before their CDF is generated.


### types
The types of the card, given as a comma-separated list, like so:  
`types: Light, Dragon, Machine`

This is required on all cards.

There can be any amount of spaces around the commas but keeping it like the example above is preferred.

The allowed types are the list of [cdfScript type constants](./TODO:).


### attack
The card's Attack, written like so:  
`attack: 900`

This is required on cards with `cardType: unit` and forbidden on others.

> **_Note:_**  
> There is no way to indicate an Attack of `?` since this only appears on tokens for which the Attack should be determined before their CDF is generated.


### defense
The card's Defense, written like so:  
`defense: 900`

This is required on cards with `cardType: unit` and forbidden on others.

> **_Note:_**  
> There is no way to indicate a Defense of `?` since this only appears on tokens for which the Defense should be determined before their CDF is generated.


### deckLimit
The number of times you can have this card in a deck, written like so:  
`deckLimit: 1`

This always corresponds to an equivalent [rules section in the card's text](./TODO:).

For cards of which you can have any number in the deck, the special value `any` is used.

If this property is not specified, it defaults to `3`.


### equipableTo
A [cdfScript expression](./TODO:) that should evaluate to `yes` or `no` when run with an implicit card representing a potential equip target.  
It indicates any extra conditions that that target needs to fulfill, written like so:  
`type = Earth`

This is only allowed on cards with `cardType: enchantSpell` or `cardType: equipableItem` and always corresponds to an equivalent [rules section in the card's text](./TODO:).

If it is not specified, it defaults to no extra restrictions.

> **_Note:_**  
> The fact that cards can only be equipped to units on the field is implied.


### turnLimit
A [cdfScript expression](./TODO:), evaluating to the number of times that cards with this name can be cast, summoned or deployed in a single turn, written like so:  
`turnLimit: 1`

This always corresponds to an equivalent [rules section in the card's text](./TODO:).

If it is not specified, it defaults to `any`.


### condition
A [cdfScript expression](./TODO:) that should evaluate to `yes` or `no`, indicating if any extra conditions for summoning, casting or deploying this card are met, written like so:  
`condition: COUNT([from exile]) >= 6`

This always corresponds to an equivalent [rules section in the card's text](./TODO:).

If it is not specified, it defaults to `yes`.


### o
An ability of the card, written like so:  
`o: trigger`

It can have any of the following values:  
- cast
- deploy
- fast
- optional
- static
- trigger

Values of `cast` and `deploy` are only allowed on spells and items, respectively.

All properties after an `o:` declaration (until the next one) are properties of the ability, not of the card itself, meaning that these should always come last.

> **_Note:_**  
> The name `o` was chosen so that the `o:` in the CDF mimicks the `●：` on the actual card.



## Ability Properties

An ability can have the following properties:

### cancellable
Either `yes` or `no`, indicating whether or not this ability can be cancelled, written like so:  
`cancellable: no`

If it is not specified, it defaults to `yes`.


### cost
A property with no value that indicates that all lines, up until the next property, are cdfScript instructions that represent the cost of activating this ability, written like so:  
`cost:`  
`LOSELIFE(100);`


### exec
A property with no value that indicates that all lines, up until the next property, are cdfScript instructions that represent what happens when the ability resolves, written like so:  
`exec:`  
`DAMAGE(opponent, 100);`

This is forbidden on `static` abilities.

If no `cost` was specified for the ability, the `exec:` does not need to be written out and the script can simply be placed after the last regular property of the ability.

### turnLimit
A [cdfScript expression](./TODO:), evaluating to the number of times that this ability can be used per turn, written like so:  
`turnLimit: 1`

If it is not specified, it defaults to `any`.


### globalTurnLimit
A [cdfScript expression](./TODO:), evaluating to the number of times that any instances of this ability can be used per turn, written like so:  
`globalTurnLimit: 1`

If it is not specified, it defaults to `any`.


### gameLimit
A [cdfScript expression](./TODO:), evaluating to the number of times that any instances of this ability can be used per game, written like so:  
`gameLimit: 1`


### zoneDurationLimit
A [cdfScript expression](./TODO:), evaluating to the number of times that this ability can be used in the duration that the card it's on is in a specific zone, written like so:  
`zoneDurationLimit: 1`

If it is not specified, it defaults to `any`.


### condition
A [cdfScript expression](./TODO:) that should evaluate to `yes` or `no`, indicating if any extra conditions for activating this ability are met, written like so:
`condition: thisCard.zone = field`

On `cast` and `deploy` abilities, this needs to be met to cast or deploy the card it is on.

If it is not specified, it defaults to `yes`.

> **_Note:_**  
> On actual cards, the fact that it needs to be on the field to activate its abilities is generally implied.  
> In CDF files this is not the case since the decision of when and when not to imply it is non-trivial and would probably lead to confusing edge-cases.


### after
A [cdfScript expression](./TODO:) that is run with an implicit `action` and should evaluate to `yes` or `no`, indicating if that action constitutes a trigger condition for this ability.  
Example:
`after: destroyed = thisCard`

This is only allowed on `trigger` and `cast` abilities and not in combination with `during`.

### afterPrecondition
A [cdfScript expression](./TODO:) that should evaluate to `yes` or `no`, indicating if any conditions on a trigger ability that should be met before the trigger happens are met.  
Example:
`afterPrecondition: thisCard.zone = field`

This is only allowed on `trigger` and `cast` abilities that also have `after`. (and therefore not in combination with `during`)


### during
A [cdfScript expression](./TODO:) that should evaluate to `yes` or `no`, depending on if a condition is met during which this trigger ability triggers, written like so:
`during: currentPhase = endPhase`

This is only allowed on `trigger` abilities and not in combination with `after` or `afterPrecondition`.

> **_Note:_**  
> Rules-wise, this is used for trigger abilities that trigger on specific phases or "(when units are) going to attack".


### mandatory
Either `yes` or `no`, indicating whether or not activating or applying this ability is mandatory or not, written like so:  
`mandatory: yes`

This is required on `trigger` abilities and `static` action modification abilities and forbidden on others.


### forPlayer
A [cdfScript expression](./TODO:) that should evaluate to the players who can activate this ability, like so:  
`forPlayer: opponent`

If this property is not specified, it defaults to `you`.


### applyTo
A [cdfScript expression](./TODO:) that should evaluate to the list of all objects that this static ability should apply to:  
`applyTo: thisCard.equippedUnit`

This is required on `static` abilities and forbidden on others.


### modifier
A [cdfScript modifier](./TODO:) that represents the modification that this static ability applies to its targets.  
Example:  
`{attack += 100}`

This is required on `static` abilities and forbidden on others.


### |o
A sub-ability contained within this ability.  
It allows the same values as `o` and all properties following it (until the next `o:` or `|o:` declaration) are part of it instead of the current ability.

> **_Unimplemented:_**
> Sub-abilities can be nested by adding additional `|`s to the property name, like so:  
> `||o: trigger`