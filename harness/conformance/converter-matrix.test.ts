// Feature-by-feature converter support, DERIVED rather than declared.
//
// A hand-maintained support table is a lie within two weeks — it records what
// someone believed when they wrote it, and nothing makes it wrong out loud. So
// every cell here comes from evidence: each corpus document is put through a
// converter round trip, and the schema objects that survive are compared with
// the ones that went in (harness/helpers/mnxDefs.ts).
//
// The five verdicts, and what each is evidence OF:
//
//   supported       every document carrying this def round-tripped with it intact
//   lossy           at least one did not — the dangerous cell, because the
//                   conversion succeeded and quietly dropped something
//   extension       it survives only under `_x.mnxLab` — a SPEC gap, and the
//                   input to spec/proposals/, not an implementation to-do
//   error           the converter threw on every document carrying it
//   untested        no document in the corpus carries it at all — the honest
//                   cell that a declared table always fakes as "supported"
//
// The two gap kinds separate by construction, which is the point: `extension`
// says MNX cannot express something a format can, and `lossy`/`error` say our
// code cannot carry something MNX can.
//
// Regenerate with: npm run update:converter-matrix
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { importMusicXML, exportMusicXML } from '../../converters/musicxml-mnx/src/index.js';
import { defsInDocument, extensionKeysInDocument } from '../helpers/mnxDefs.ts';
import { isPlumbingDef } from '../../src/corpus/plumbingDefs.ts';
import mnxSchema from '../../spec/mnx-schema.json';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
// Written into src/, not harness/reports/, because the workbench renders it —
// generated, committed, importable from any layer, exactly as worker/generated/
// carries the precompiled validators. The harness may not reach into a shell,
// so the data has to live below both.
const REPORT_PATH = path.join(ROOT, '..', 'src', 'corpus', 'generated', 'converter-matrix.json');
const UPDATING = !!process.env.UPDATE_CONVERTER_MATRIX;

type Verdict = 'supported' | 'lossy' | 'extension' | 'error' | 'untested';

interface Source {
  id: string;
  document: unknown;
}

/**
 * One converter direction pair, exercised as a round trip.
 *
 * A round trip is the only shape that can be scored automatically — it is not
 * proof of correctness (a symmetric bug survives one untouched, which is what
 * the W3C oracle is for), but it is exact about LOSS, which is what a support
 * matrix is asking.
 */
interface Lane {
  key: string;
  label: string;
  roundTrip: (document: unknown) => unknown;
}

const LANES: Lane[] = [
  {
    key: 'musicxml',
    label: 'MusicXML',
    roundTrip: document => importMusicXML(exportMusicXML(document as never))
  }
];

/** Every committed MNX document worth scoring: the corpus plus the fixtures. */
function loadSources(): Source[] {
  const sources: Source[] = [];
  const scenarioRoot = path.join(ROOT, '..', 'scenarios');
  for (const origin of ['spec', 'lab']) {
    const originDir = path.join(scenarioRoot, origin);
    if (!fs.existsSync(originDir)) continue;
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (entry.name !== 'document.mnx.json') continue;
        sources.push({
          id: path.relative(scenarioRoot, dir),
          document: JSON.parse(fs.readFileSync(full, 'utf8'))
        });
      }
    };
    walk(originDir);
  }
  const fixtureDir = path.join(ROOT, '..', 'converters', 'fixtures');
  for (const entry of fs.readdirSync(fixtureDir)) {
    if (!entry.endsWith('.mnx.json')) continue;
    sources.push({
      id: `fixtures/${entry.replace(/\.mnx\.json$/, '')}`,
      document: JSON.parse(fs.readFileSync(path.join(fixtureDir, entry), 'utf8'))
    });
  }
  return sources.sort((a, b) => a.id.localeCompare(b.id));
}

const FEATURE_DEFS = Object.keys((mnxSchema as { $defs: Record<string, unknown> }).$defs)
  .filter(def => !isPlumbingDef(def))
  .sort();

interface Tally {
  carried: number;
  survived: number;
  viaExtension: number;
  threw: number;
  /** The first document that lost it — a cell without evidence is a scoreboard. */
  lostIn?: string;
  /** The first document carrying it at all, for rows that never got lost. */
  firstIn?: string;
}

interface Cell {
  verdict: Verdict;
  /** Documents carrying this row, and how many kept it through the trip. */
  carried?: number;
  survived?: number;
  /** Where to look first: what lost it, or — for `extension` — where it is. */
  evidence?: string;
}

function score(sources: Source[], lane: Lane): { rows: Record<string, Cell>; failures: string[] } {
  const tallies = new Map<string, Tally>();
  const failures: string[] = [];
  const bump = (row: string, apply: (t: Tally) => void): void => {
    const tally = tallies.get(row) ?? { carried: 0, survived: 0, viaExtension: 0, threw: 0 };
    apply(tally);
    tallies.set(row, tally);
  };

  for (const source of sources) {
    const before = defsInDocument(source.document);
    const beforeExtensions = extensionKeysInDocument(source.document);
    let after: Set<string>;
    let afterExtensions: Set<string>;
    try {
      const returned = lane.roundTrip(source.document);
      after = defsInDocument(returned);
      afterExtensions = extensionKeysInDocument(returned);
    } catch (error) {
      failures.push(`${source.id}: ${String((error as Error)?.message).split('\n')[0].slice(0, 120)}`);
      const note = (t: Tally): void => {
        t.carried++;
        t.threw++;
        t.firstIn ??= source.id;
        t.lostIn ??= source.id;
      };
      for (const def of before) bump(def, note);
      for (const key of beforeExtensions) bump(key, note);
      continue;
    }
    for (const def of before) {
      bump(def, t => {
        t.carried++;
        t.firstIn ??= source.id;
        if (after.has(def)) t.survived++;
        else t.lostIn ??= source.id;
      });
    }
    for (const key of beforeExtensions) {
      bump(key, t => {
        t.carried++;
        t.firstIn ??= source.id;
        if (afterExtensions.has(key)) {
          t.survived++;
          t.viaExtension++;
        } else t.lostIn ??= source.id;
      });
    }
  }

  const rows: Record<string, Cell> = {};
  const extensionRows = [...tallies.keys()].filter(row => row.startsWith('_x.mnxLab.')).sort();
  for (const row of [...FEATURE_DEFS, ...extensionRows]) {
    const tally = tallies.get(row);
    if (!tally || tally.carried === 0) {
      rows[row] = { verdict: 'untested' };
      continue;
    }
    const verdict: Verdict =
      tally.threw === tally.carried
        ? 'error'
        : tally.viaExtension > 0 && tally.viaExtension === tally.survived
          ? 'extension'
          : tally.survived === tally.carried
            ? 'supported'
            : 'lossy';
    rows[row] = {
      verdict,
      carried: tally.carried,
      survived: tally.survived,
      // `lossy`/`error` point at what broke; `extension` never broke, so it
      // points at somewhere the feature can be seen instead.
      ...(verdict === 'supported' ? {} : { evidence: tally.lostIn ?? tally.firstIn })
    };
  }
  return { rows, failures };
}

const sources = loadSources();
const lanes = LANES.map(lane => {
  const { rows, failures } = score(sources, lane);
  const counts: Record<Verdict, number> = {
    supported: 0,
    lossy: 0,
    extension: 0,
    error: 0,
    untested: 0
  };
  for (const cell of Object.values(rows)) counts[cell.verdict]++;
  return { key: lane.key, label: lane.label, counts, rows, failures: failures.sort() };
});

const report = {
  note:
    'Generated by `npm run update:converter-matrix` (MusicXML campaign item 8). ' +
    'Every cell is DERIVED from a round trip over the committed corpus, never declared. ' +
    '`extension` means the feature survives only under _x.mnxLab — a spec gap, not an ' +
    'implementation gap. `untested` means no document exercises it, which is not the ' +
    'same as unsupported. Hand-editing this file is a red test.',
  sources: sources.length,
  rows: FEATURE_DEFS.length,
  lanes
};

if (UPDATING) {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
}

describe('converter support matrix', () => {
  it('scores every feature def against every lane', () => {
    expect(sources.length).toBeGreaterThan(50);
    for (const lane of lanes) {
      const scored = Object.keys(lane.rows).length;
      expect(scored).toBeGreaterThanOrEqual(FEATURE_DEFS.length);
    }
  });

  it('matches the committed matrix', () => {
    if (UPDATING) return;
    expect(
      fs.existsSync(REPORT_PATH),
      `missing ${REPORT_PATH} — run npm run update:converter-matrix`
    ).toBe(true);
    expect(report).toEqual(JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8')));
  });

  it('never loses ground on a lane', () => {
    if (UPDATING) return;
    const committed = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8')) as typeof report;
    for (const lane of lanes) {
      const before = committed.lanes.find(l => l.key === lane.key);
      if (!before) continue;
      expect(lane.counts.supported, `${lane.key} supports fewer defs than it did`).toBeGreaterThanOrEqual(
        before.counts.supported
      );
    }
  });
});

// The committed JSON is imported directly by src/workbench/ConvertersPage.ts,
// so its shape is a contract between a generator and a page that never see each
// other. These assert the fields that page reads.
describe('the shape the workbench renders', () => {
  const VERDICTS = ['supported', 'lossy', 'extension', 'error', 'untested'] as const;

  it('gives every lane counts for every verdict, and every row a known verdict', () => {
    for (const lane of lanes) {
      expect(Object.keys(lane.counts).sort()).toEqual([...VERDICTS].sort());
      for (const [name, cell] of Object.entries(lane.rows)) {
        expect(VERDICTS.includes(cell.verdict), `${name}: ${cell.verdict}`).toBe(true);
        // A non-supported cell without evidence is a scoreboard entry, which is
        // exactly what this page exists not to be.
        if (cell.verdict !== 'supported' && cell.verdict !== 'untested') {
          expect(cell.evidence, `${name} has no evidence`).toBeTruthy();
        }
      }
      // The counts have to agree with the rows they summarise.
      const tallied = Object.values(lane.rows).reduce<Record<string, number>>((acc, cell) => {
        acc[cell.verdict] = (acc[cell.verdict] ?? 0) + 1;
        return acc;
      }, {});
      for (const verdict of VERDICTS) expect(lane.counts[verdict]).toBe(tallied[verdict] ?? 0);
    }
  });

  it('names evidence that actually exists', () => {
    const ids = new Set(sources.map(source => source.id));
    for (const lane of lanes) {
      for (const cell of Object.values(lane.rows)) {
        if (cell.evidence) expect(ids.has(cell.evidence), cell.evidence).toBe(true);
      }
    }
  });
});
