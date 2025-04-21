# Variables

## Types

Variables in cdfScript can be of any of the following types:
- ability
- abilityId
- bool
- card
- cardId
- cardType
- counter
- fight
- modifier
- number
- player
- timeIndicator
- type
- zone

The `cardId` type is generally analogous to card names, whereas the `abilityId` type is mostly an implementation detail and behaves the same as `ability` in many cases.

## Usage

All variables are prefixed with a `$` to mark them as such.  
Certain expressions, such as a `both.SELECT( ... )` can generate split values, which have a value for either player.  
What a split value resolves to when it gets used, depends on which player is in context at that time.  
This is generally the acting player who activated the effect or is performing the current effect section.

### Declarations

There is two ways to declare variables:

1. Regular Assignment  
Example: `$cards = SELECT(1, [from you.hand]);`  
This method is only valid in situations where the script is evaluated line-by-line, such as the `exec` and `cost` sections of abilities.

2. Variable capturing  
Example: `$cards{SELECT(1, [from you.hand])}`  
A variable capture (`$name{ ... }`) can be inserted around any expression inside the `after` of an ability.  
Its return value is simply the return value of the inner expression.  
This means that it does not influence the code around it in any way, apart from setting its variable.  
The captured variable is set to all the return values of the inner expression, summed up, and it is only reset (to 0 or the empty list) at the beginning of a stack.
