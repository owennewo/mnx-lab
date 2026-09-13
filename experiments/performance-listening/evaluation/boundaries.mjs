import { execFileSync } from "node:child_process";
import { root } from "./io.mjs";
execFileSync(
  "node_modules/.bin/depcruise",
  [
    "src",
    "worker",
    "harness",
    "apps",
    "experiments/performance-listening",
    "--config",
    ".dependency-cruiser.cjs",
  ],
  { cwd: root, stdio: "inherit" },
);
