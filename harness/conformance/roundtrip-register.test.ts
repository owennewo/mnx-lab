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
import { importGuitarProCleanRoom } from '../../converters/guitarpro-mnx/src/cleanRoom.ts';
import { exportGuitarProGpif, STORAGE_EXPORT_OPTIONS } from '../../converters/guitarpro-mnx/src/gpif/fromMnx.ts';
import { collapseDifferences, compareDocuments, type DifferenceShape } from '../../src/model/documentCompare.ts';
import { loadCorpus } from '../verify/check-scenarios.mjs';

const ROOT = path.join(__dirname, '..', '..');
const REGISTER_PATH = path.join(__dirname, '..', 'fixtures', 'roundtrip-register.json');
const FIXTURES_DIR = path.join(ROOT, 'converters', 'fixtures');
const UPDATE = process.env.UPDATE_ROUNDTRIP_REGISTER === '1';
const OPERATOR_DIR = process.env.ROUNDTRIP_DIR;
const OPERATOR_REPORT = process.env.ROUNDTRIP_REPORT;

/**
 * `gains` is its own verdict because it is its own finding: nothing that went
 * in was lost or changed, but the document that comes back says MORE — Guitar
 * Pro has no "unstated", so a track always returns with a tuning, a key, a
 * transposition and a voice name. Not a loss, and not nothing either: a
 * notation-only part reloads as one with strings.
 */
interface Entry {
  verdict: 'clean' | 'gains' | 'differs' | 'error';
  error?: string;
  differences?: DifferenceShape[];
  warnings?: { message: string; count: number }[];
}
type Exportable = Parameters<typeof exportGuitarProGpif>[0];

/** Warnings name bars, ids and texts; the register wants the KIND of warning. */
function collapseWarnings(warnings: string[]): Entry['warnings'] {
  const counts = new Map<string, number>();
  for (const warning of warnings) {
    const message = warning.replace(/"[^"]*"/g, '"…"').replace(/\d+/g, '#');
    counts.set(message, (counts.get(message) ?? 0) + 1);
  }
  return [...counts].map(([message, count]) => ({ message, count })).sort((a, b) => a.message.localeCompare(b.message));
}

/** MNX → .gp → MNX, judged against the document that went in. */
function roundTrip(document: unknown): Entry {
  const warnings: string[] = [];
  let returned: unknown;
  try {
    // A SAVE, not an export for a person: the storage options, as studio will use.
    const bytes = exportGuitarProGpif(document as Exportable, { ...STORAGE_EXPORT_OPTIONS, onWarning: message => warnings.push(message) });
    returned = importGuitarProCleanRoom(bytes);
  } catch (error) {
    return { verdict: 'error', error: (error as Error).message.replace(/\d+/g, '#') };
  }
  const differences = collapseDifferences(compareDocuments(document, returned));
  const entry: Entry = {
    verdict: !differences.length ? 'clean' : differences.every(d => d.kind === 'gained') ? 'gains' : 'differs'
  };
  if (differences.length) entry.differences = differences;
  if (warnings.length) entry.warnings = collapseWarnings(warnings);
  return entry;
}

function fixtureLane(dir: string): Record<string, Entry> {
  const lane: Record<string, Entry> = {};
  for (const file of fs.readdirSync(dir).filter(f => /\.(gp|gpx|gp[345])$/i.test(f)).sort()) {
    try {
      lane[file] = roundTrip(importGuitarProCleanRoom(new Uint8Array(fs.readFileSync(path.join(dir, file)))));
    } catch (error) {
      lane[file] = { verdict: 'error', error: `import: ${(error as Error).message.replace(/\d+/g, '#')}` };
    }
  }
  return lane;
}

function corpusLane(): Record<string, Entry> {
  const lane: Record<string, Entry> = {};
  for (const scenario of loadCorpus() as { id: string; dir: string }[]) {
    const file = path.join(scenario.dir, 'document.mnx.json');
    if (fs.existsSync(file)) lane[scenario.id] = roundTrip(JSON.parse(fs.readFileSync(file, 'utf8')));
  }
  return lane;
}

function report(lanes: Record<string, Record<string, Entry>>) {

  // The backlog, ranked: each path shape with the number of documents it bit.
  const shapes = new Map<string, { path: string; kind: string; documents: number; count: number }>();
  const verdicts = { clean: 0, gains: 0, differs: 0, error: 0 };
  for (const lane of Object.values(lanes)) for (const entry of Object.values(lane)) {
    verdicts[entry.verdict]++;
    for (const { path: shape, kind, count } of entry.differences ?? []) {
      const key = `${shape} | ${kind}`;
      const total = shapes.get(key) ?? { path: shape, kind, documents: 0, count: 0 };
      total.documents++; total.count += count;
      shapes.set(key, total);
    }
  }
  const ranked = (gained: boolean) => [...shapes.values()].filter(s => (s.kind === 'gained') === gained)
    .sort((a, b) => b.documents - a.documents || b.count - a.count || a.path.localeCompare(b.path));
  return { generatedBy: 'npm run update:roundtrip-register', verdicts, lostOrChanged: ranked(false), gained: ranked(true), lanes };
}

describe('Guitar Pro round-trip register', () => {
  it('matches the committed register', () => {
    const current = JSON.stringify(report({ corpus: corpusLane(), fixture: fixtureLane(FIXTURES_DIR) }), null, 2) + '\n';
    if (UPDATE) { fs.writeFileSync(REGISTER_PATH, current); return; }
    expect(fs.existsSync(REGISTER_PATH), 'run `npm run update:roundtrip-register`').toBe(true);
    expect(current, 'the round trip changed — regenerate the register and review its git diff').toBe(fs.readFileSync(REGISTER_PATH, 'utf8'));
  }, 120_000);

  it.runIf(!!OPERATOR_DIR && !!OPERATOR_REPORT)('reports a private library without recording it', () => {
    const resolved = path.resolve(OPERATOR_REPORT!);
    expect(resolved.startsWith(path.resolve(ROOT) + path.sep), 'a private library\'s report belongs outside the repo').toBe(false);
    const lane = fixtureLane(OPERATOR_DIR!);
    expect(Object.keys(lane).length).toBeGreaterThan(0);
    fs.writeFileSync(resolved, JSON.stringify(report({ library: lane }), null, 2) + '\n');
  }, 600_000);
});
