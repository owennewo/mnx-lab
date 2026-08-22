// The roster is the output of stored queries, and this file is both halves of
// that claim (core-assist-model-selector.md's first consumer).
//
//   npm test              — asserts worker/models.json is exactly what
//                           worker/models.query.json returns against the
//                           committed catalog snapshot. A hand-edit to the
//                           roster is therefore a red test, which is the whole
//                           point: the queries are the source, the roster is
//                           derived.
//   npm run update:roster — WRITES the roster instead of asserting, and prints
//                           the per-lane delta and the query trace.
//   npm run refresh:catalog — fetches OpenRouter's live catalog first, rewrites
//                           the snapshot, then regenerates. The ONLY thing in
//                           the harness that touches the network, behind its
//                           own env flag, never in `npm test`.
//
// The pattern is update:primitives': the generator lives in the test that
// pins its output, so regeneration and verification can never drift apart.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  buildRoster,
  isCanonical,
  rosterDelta,
  type RosterDefinition,
  type RosterEntry,
} from '../../src/assist/roster.ts';
import {
  fetchLiveCatalog,
  serializeSnapshot,
  snapshotCatalog,
  SNAPSHOT_FETCHED_AT,
} from '../../src/assist/modelCatalog.ts';
import type { CatalogModel } from '../../src/assist/modelSelect.ts';

const UPDATE = process.env.UPDATE_ROSTER === '1';
/** Straight to stderr, not console.warn: vitest's default reporter swallows
 *  console output from a PASSING test, and a generator whose report only
 *  appears when it fails is no report at all. */
function report(line: string) {
  process.stderr.write(`${line}\n`);
}
const REFRESH = process.env.REFRESH_CATALOG === '1';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const QUERY_FILE = path.join(ROOT, 'worker', 'models.query.json');
const ROSTER_FILE = path.join(ROOT, 'worker', 'models.json');
const SNAPSHOT_FILE = path.join(ROOT, 'src', 'assist', 'modelCatalog.snapshot.json');

interface RosterFile {
  generatedBy: string;
  catalog: string;
  lanes: Record<string, RosterEntry[]>;
}

const definition = JSON.parse(fs.readFileSync(QUERY_FILE, 'utf8')) as RosterDefinition;
const committed = JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf8')) as RosterFile;

/** The catalog this run judges against: the committed snapshot, or a fresh
 *  fetch that becomes the new committed snapshot. */
async function catalogForRun(): Promise<{ catalog: CatalogModel[]; provenance: string }> {
  if (!REFRESH) return { catalog: snapshotCatalog(), provenance: `snapshot ${SNAPSHOT_FETCHED_AT}` };
  const live = await fetchLiveCatalog();
  const fetchedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(SNAPSHOT_FILE, serializeSnapshot(live, fetchedAt));
  report(`CATALOG refreshed: ${live.length} assessable models, ${fetchedAt}`);
  return { catalog: live, provenance: `snapshot ${fetchedAt}` };
}

const { catalog, provenance } = await catalogForRun();
const built = buildRoster(definition, catalog);

const next: RosterFile = {
  generatedBy: 'npm run update:roster — worker/models.query.json is the source; do not hand-edit',
  catalog: provenance,
  lanes: built.roster,
};

describe('the roster is what the stored queries return', () => {
  it('regenerates worker/models.json — UPDATE_ROSTER=1 only', () => {
    if (!UPDATE) return;
    for (const row of built.trace) {
      report(
        `  ${row.lane}/${row.query}${row.duplicate ? ' (already taken)' : ''}: ` +
          `${row.entry.id} score ${row.score.toFixed(2)} $${row.effectivePrice.toFixed(3)}/Mtok`,
      );
    }
    for (const [lane, delta] of Object.entries(rosterDelta(committed?.lanes ?? {}, built.roster))) {
      if (!delta.added.length && !delta.dropped.length) continue;
      report(`ROSTER ${lane}: +[${delta.added.join(', ')}] \u2212[${delta.dropped.join(', ')}]`);
    }
    fs.writeFileSync(ROSTER_FILE, JSON.stringify(next, null, 2) + '\n');
  });

  it('reproduces the committed worker/models.json', () => {
    // Hand-edit either side and this fails. Regenerate instead:
    //   npm run update:roster
    const current = JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf8')) as RosterFile;
    expect(current.lanes).toEqual(built.roster);
  });

  it('every derived lane is non-empty — a query that returns nothing is a bug, not a roster', () => {
    for (const [lane, spec] of Object.entries(definition.lanes)) {
      if (!spec.queries?.length) continue;
      expect(built.roster[lane]?.length, lane).toBeGreaterThan(0);
    }
  });

  it('every query says why it exists', () => {
    for (const spec of Object.values(definition.lanes)) {
      for (const query of spec.queries ?? []) {
        expect(query.why.length).toBeGreaterThan(20);
        expect(query.take).toBeGreaterThan(0);
      }
    }
  });
});

describe('what the roster promises about its rows', () => {
  const derived = new Set(
    Object.entries(definition.lanes)
      .filter(([, spec]) => spec.queries?.length)
      .flatMap(([lane]) => built.roster[lane] ?? [])
      .map(e => e.id),
  );
  const byId = new Map(catalog.map(m => [m.id, m]));

  it('names only canonical endpoints — no :free, no :batch, no ~latest alias', () => {
    for (const id of derived) expect(isCanonical(id), id).toBe(true);
  });

  it('every derived row is a real catalog row that supports tool calling', () => {
    for (const id of derived) {
      const model = byId.get(id);
      expect(model, id).toBeDefined();
      expect(model!.parameters, id).toContain('tools');
    }
  });

  it('every derived row has the priors its query required — the roster admits no unknowns', () => {
    for (const id of derived) {
      const model = byId.get(id)!;
      expect(model.intelligenceIndex, id).toBeDefined();
      expect(model.tokensPerSecond, id).toBeDefined();
    }
  });

  it('the transcribe lane survives verbatim — declared, because no catalog scores it', () => {
    expect(built.roster.transcribe).toEqual(definition.lanes.transcribe.declared);
  });
});
