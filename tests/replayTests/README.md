# Replay Tests

Replay tests are end-to-end tests for the rules engine as a whole.  
They all consist of a replay file which is played to completion by the test runner.
Whether the test failed or passes depends ont the type of replay test it is:

## Valid Tests
Each valid replay test passes if it can be played to completion.
This ensures that no action in the replay causes a rules engine crash.

## Invalid Tests
Each invalid replay test has an expected error it should throw. (`expectedError` in the replay's `extra` property)  
If the replay does not throw that specific error, or does not throw an error at all, the test fails.  
These tests are usually created to ensure that players cannot perform certain illegal actions, generally after fixing the bug that allowed them to do so.

## State Tests
Each state test is accompanied by an expectation file, which is a serialized form of the gamestate at the end of the replay.  
This type of test passes if it does not crash and the serializing the game state at the end of the replay yields the expected serialization.