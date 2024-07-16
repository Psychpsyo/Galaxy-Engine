# Spell Tests

Spell tests are essentially unit tests for cdfScript.  
They run a game where the starting player casts a single debug spell (CUS00000) whose `cast` ability is the test script.  
The test script can use `WINGAME()` to indicate a passing test and `opponent.WINGAME()` to indicate test failure.