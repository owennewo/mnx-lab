// The round-trip register over a PRIVATE library (an operator's Soundslice .gp
// cache): the same measurement as the committed register's fixture lane, written
// to a report OUTSIDE the repository, because the scores are not ours to commit.
// It was a test that skipped itself in every normal run; it is an operator tool.
//
//   npm run report:roundtrip-library -- <library dir> <report.json>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureLane, report } from '../helpers/roundtripRegister.ts';

const ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const [dir, out] = process.argv.slice(2).filter(arg => arg !== '--');
if (!dir || !out) {
  console.error('usage: npm run report:roundtrip-library -- <library dir> <report.json>');
  process.exit(1);
}
const resolved = path.resolve(out);
if (resolved.startsWith(ROOT + path.sep)) {
  console.error(`a private library's report belongs outside the repository, not ${resolved}`);
  process.exit(1);
}
const lane = fixtureLane(path.resolve(dir));
if (!Object.keys(lane).length) {
  console.error(`no Guitar Pro files found in ${dir}`);
  process.exit(1);
}
fs.writeFileSync(resolved, JSON.stringify(report({ library: lane }), null, 2) + '\n');
console.log(`${Object.keys(lane).length} scores → ${resolved}`);
