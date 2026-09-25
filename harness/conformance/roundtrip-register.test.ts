// The Guitar Pro round-trip register: what a save would lose, as evidence
// (roadmap/complete/core-roundtrip-register.md, studio authoring campaign item 1).
//
// Studio stores `.gp` and works in MNX, so every save crosses the exporter and
// every load crosses the importer. This register is what that crossing costs
// today, measured rather than believed — the converter's backlog, and the list
// of things an editor must mark "will not persist". Two lanes:
//
//   corpus    a committed MNX document → .gp → MNX, compared with itself.
//             What a save loses of a document AUTHORED in MNX.
//   fixture   a committed .gp/.gpx → MNX → .gp → MNX, the two imports compared.
//             What a save loses of a document that CAME from Guitar Pro — the
//             library's case — where the first import has already dropped
//             whatever MNX cannot hold.
//
// The judge is src/model/documentCompare.ts (ids by resolution, `encoding`
// discounted); differences are collapsed to path shapes with counts, and the
// exporter's warnings ride beside them with their numbers and names blanked.
// A difference no warning explains is a converter defect — until warnings are
// structured that reading is a human's, and this file is what they read.
//
// The honesty mechanism is the edit-traces one: when a converter legitimately
// changes behaviour, `npm run update:roundtrip-register` regenerates the file
// and GIT DIFF IS THE REVIEW.
//
// Operator lane, never committed: `ROUNDTRIP_DIR=<dir of .gp files>
// ROUNDTRIP_REPORT=<out.json> npx vitest run harness/conformance/roundtrip-register.test.ts`
// runs the fixture lane over a private library (the Soundslice cache) and writes
// the same shape of report OUTSIDE the repo; the register is not touched.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { corpusLane, fixtureLane, report } from '../helpers/roundtripRegister.ts';

const ROOT = path.join(__dirname, '..', '..');
const REGISTER_PATH = path.join(__dirname, '..', 'fixtures', 'roundtrip-register.json');
const FIXTURES_DIR = path.join(ROOT, 'converters', 'fixtures');
const UPDATE = process.env.UPDATE_ROUNDTRIP_REGISTER === '1';

describe('Guitar Pro round-trip register', () => {
  it('matches the committed register', () => {
    const current = JSON.stringify(report({ corpus: corpusLane(), fixture: fixtureLane(FIXTURES_DIR) }), null, 2) + '\n';
    if (UPDATE) { fs.writeFileSync(REGISTER_PATH, current); return; }
    expect(fs.existsSync(REGISTER_PATH), 'run `npm run update:roundtrip-register`').toBe(true);
    expect(current, 'the round trip changed — regenerate the register and review its git diff').toBe(fs.readFileSync(REGISTER_PATH, 'utf8'));
  }, 120_000);
});
