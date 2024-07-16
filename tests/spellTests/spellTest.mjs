// This is here to run a single spell test manually from the command line

import {runTest} from "./lib.mjs";

await runTest(process.argv[2]);