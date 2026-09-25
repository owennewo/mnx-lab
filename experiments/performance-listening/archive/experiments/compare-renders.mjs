import fs from "node:fs";
import { compareRenders } from "../evaluation/render-repeat.mjs";
import { writeJSON } from "../evaluation/io.mjs";
const [left, right, output] = process.argv.slice(2);
if (!left || !right || !output)
  throw Error("Usage: compare-renders LEFT_AUDIO RIGHT_AUDIO NEW_REPORT.json");
if (fs.existsSync(output)) throw Error("Refusing to overwrite " + output);
const result = compareRenders(left, right);
writeJSON(output, result);
console.log(
  `${result.differentRecordings}/${result.totalRecordings} recordings differ; max sample difference ${result.maxAbs}.`,
);
