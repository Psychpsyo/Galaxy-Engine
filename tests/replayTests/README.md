# Replay Tests

Replay tests are end-to-end tests for the rules engine as a whole.  
Each test is comprised of a replay file, together with an expected error it should throw. (`expectedError` in the replay's `extra` property)  
If the replay does not throw that specific error, or does not throw an error at all, the test fails.  
These tests are usually created to ensure that players cannot perform certain illegal actions, generally after fixing the bug that allowed them to do so.