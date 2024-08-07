# Control Flow

By default, the execution of an effect is linear, going from the top of the script to the bottom.  
But for cards that necessitate branches, the following features can be used.

# If-Statements
If-statements can be used to do something only if a condition is met and are written like so:  
```
if (condition) {} else {};
```
`condition` can be any expression that evaluates to `yes` or `no`. Anything within the first set of curly braces is done if said condition is met and anything in the second set is done if it isn't met.

# Optional Sections
Optional sections are used to express card effects where one thing or another happens based on whether or not a player wants to or is able to do it.  
These sections are usually worded as such:  
"Next, you may do X."  
"Do X. If you can't, do Y."  
"Your opponent may do X. If they do, do Y. If they don't, do Z."

They also use cost-wording. ("Pay 100 life." instead of "Lose 100 life.")

## Types of Optional Sections
There are two main types of optional sections. `may` statements and `try` statements.  

`may` statements are to give the player a choice of whether or not to do a certain part of the effect.

`try` statements specify a part of the effect that is done only if fully possible.

Both of these follow similar rules for their syntax:  
```
player.may {} then {} else {};
try {} then {} else {};
```
Both the `then` and `else` clauses are optional but if both are used, they must be in this order.

If the optional section is done, it is followed by the `then` section.  
If it is not done, the `else` section is done instead.