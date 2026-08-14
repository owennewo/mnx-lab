// Construct traces — the element-ops exemplar's FORWARD harness
// (roadmap/complete/core-element-ops-exemplar.md, campaign
// core-campaign-element-ops.md item 1).
//
// A fixture in harness/fixtures/construct-traces/ names a TARGET corpus
// scenario and an intent list. Replay starts from the literal empty document
// `{}` — genesis is ops (addPart materializes the skeleton), so every trace
// builds its own scaffolding. Four verdicts per fixture:
//
//   1. the replayed document is schema-valid (FINAL doc only — `{}` is not
//      valid MNX and needn't be; mid-flight invalidity is already normal)
//   2. undo-all returns to `{}` byte-identically
//   3. THE KEYBOARD JOIN (static, no replay needed): every intent type in
//      the trace is either bound in a keymap layer or emitted by a
//      documented shell surface (SURFACE_INTENTS) — keyboard-reachability
//      is machine-checked, never assumed
//   4. THE VERDICT: the replayed doc's primitives equal the target's
//      committed expected.primitives.json after KEY NORMALIZATION — the
//      goldens embed note ids as `sourceId` keys; trace-built notes are
//      id-less, so both sides normalize to positional keys before comparing
//
// Plus one INFORMATIONAL report, never asserted: raw doc deep-equality vs
// the target's score.mnx.json. Where it fails (ids the entry surface does
// not mint) is itself campaign data, logged for the learnings ledger.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { replayIntents } from '../../src/edit/session.ts';
import type { EditorIntent } from '../../src/edit/intents.ts';
import { EDIT_LAYER, NAVIGATION_LAYER, TAB_DIGIT_LAYER } from '../../src/edit/keymap.ts';
import { SURFACE_INTENTS } from '../../src/edit/keymapDocs.ts';
import { syntheticNoteKey } from '../../src/model/noteKeys.ts';
import { kindHasConstructOp, walkElements } from '../../src/edit/elementWalk.ts';
import { isTimedEvent, type MnxNote, type MnxStructure } from '../../src/model/mnx.ts';
import { computePrimitives } from '../helpers/corpusPrimitives.ts';
import validateMnx from '../../worker/generated/validate-mnx.mjs';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus } from '../verify/check-scenarios.mjs';

interface ConstructFixture {
  target: string;
  intents: EditorIntent[];
}

const FIXTURES_DIR = path.join(__dirname, '../fixtures/construct-traces');

const fixtureFiles = fs.existsSync(FIXTURES_DIR)
  ? fs.readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.json')).sort()
  : [];

const dirById = new Map<string, string>(
  loadCorpus().map((s: { id: string; dir: string }) => [s.id, s.dir])
);

/** Every intent type a physical binding claims. */
function boundIntentTypes(): Set<string> {
  return new Set(
    [...NAVIGATION_LAYER.bindings, ...EDIT_LAYER.bindings, ...TAB_DIGIT_LAYER.bindings].map(
      b => b.intent.type
    )
  );
}

/** real note id → positional key, over the parts[0]/staff-1 universe the
 *  goldens' sourceIds draw from (the noteKeys traversal). */
function idToPositionalMap(doc: MnxStructure): Map<string, string> {
  const map = new Map<string, string>();
  (doc.parts?.[0]?.measures ?? []).forEach((measure, measureIndex) => {
    (measure.sequences ?? [])
      .filter(s => (s.staff ?? 1) === 1)
      .forEach((sequence, voiceIndex) => {
        sequence.content.forEach((item, eventIndex) => {
          if (!isTimedEvent(item)) return;
          ((item.notes ?? []) as MnxNote[]).forEach((note, noteIndex) => {
            if (note.id !== undefined)
              map.set(note.id, syntheticNoteKey(measureIndex, voiceIndex, eventIndex, noteIndex));
          });
        });
      });
  });
  return map;
}

/** Deep-copy `value` with every `sourceId` field mapped through `ids`. */
function normalizeSourceIds<T>(value: T, ids: Map<string, string>): T {
  if (Array.isArray(value)) return value.map(v => normalizeSourceIds(v, ids)) as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = k === 'sourceId' && typeof v === 'string' ? ids.get(v) ?? v : normalizeSourceIds(v, ids);
    }
    return out as T;
  }
  return value;
}

/** Paths where two JSON values differ (for the informational doc report). */
function diffPaths(a: unknown, b: unknown, prefix = '', out: string[] = []): string[] {
  if (out.length >= 12) return out; // enough to characterize the delta
  if (Array.isArray(a) && Array.isArray(b)) {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) diffPaths(a[i], b[i], `${prefix}[${i}]`, out);
    return out;
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys)
      diffPaths(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        `${prefix}.${key}`,
        out
      );
    return out;
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) out.push(prefix || '(root)');
  return out;
}

describe('construct traces (element-ops exemplar)', () => {
  it('has at least one fixture', () => {
    expect(fixtureFiles.length).toBeGreaterThan(0);
  });

  for (const file of fixtureFiles) {
    it(file, () => {
      const fixture = JSON.parse(
        fs.readFileSync(path.join(FIXTURES_DIR, file), 'utf8')
      ) as ConstructFixture;
      const dir = dirById.get(fixture.target);
      expect(dir, `fixture targets unknown scenario id: ${fixture.target}`).toBeTruthy();

      // 3. The keyboard join first — static, so it fails fast and names the
      // unreachable intent before any replay noise.
      const bound = boundIntentTypes();
      const surfaced = new Set(Object.values(SURFACE_INTENTS).flat());
      for (const intent of fixture.intents) {
        expect(
          bound.has(intent.type) || surfaced.has(intent.type),
          `intent '${intent.type}' has no keyboard surface — no binding claims it and no SURFACE_INTENTS entry emits it`
        ).toBe(true);
      }

      // Replay from the literal empty document.
      const empty = {} as MnxStructure;
      const session = replayIntents(JSON.parse(JSON.stringify(empty)), fixture.intents);

      // 1. Final document is schema-valid.
      expect(
        validateMnx(session.doc),
        `replayed document is schema-invalid: ${JSON.stringify(validateMnx.errors?.slice(0, 3))}`
      ).toBe(true);

      // 4. THE VERDICT: primitives vs the committed golden, key-normalized
      // on both sides (golden: real ids; replay: any minted ids).
      const targetDoc = JSON.parse(
        fs.readFileSync(path.join(dir!, 'score.mnx.json'), 'utf8')
      ) as MnxStructure;
      const golden = JSON.parse(
        fs.readFileSync(path.join(dir!, 'expected.primitives.json'), 'utf8')
      ) as unknown;
      const replayed = JSON.parse(JSON.stringify(computePrimitives(session.doc))) as unknown;
      expect(normalizeSourceIds(replayed, idToPositionalMap(session.doc))).toEqual(
        normalizeSourceIds(golden, idToPositionalMap(targetDoc))
      );

      // Informational: the raw doc delta — reported, never asserted.
      const delta = diffPaths(session.doc, targetDoc);
      if (delta.length > 0) {
        console.warn(`${file}: doc delta vs score.mnx.json (informational): ${delta.join(', ')}`);
      }

      // 2. Undo-all returns to `{}` byte-identically.
      while (session.canUndo) session.handleIntent({ type: 'undo' });
      expect(JSON.stringify(session.doc)).toBe('{}');
    });
  }
});

// ---------------------------------------------------------------------------
// Campaign item 3: the forward verdict for all 106
// (roadmap/inprogress/core-element-ops-construct-traces.md)
//
// The destruct axis is generative, so item 2 got verdicts for the whole corpus
// the day it ran. A trace cannot be generated — it is a recorded performance —
// so the forward answer is deliberately TWO things:
//
//   the PREDICTION  computed statically from the element inventory: does every
//                   kind this scenario contains have a construct verb?
//   the VERDICT     earned only by a committed trace that replays from `{}`
//                   and matches the goldens (the fixture tests above)
//
// Where they disagree, the disagreement is the finding — and item 1 already
// met the first one: `open-strings-chord` traces green while its document
// declares a clef no op can author, because the engine draws the same default
// anyway. A prediction that called it unreachable would have been wrong about
// the only thing that matters.

const COVERAGE_PATH = path.join(__dirname, '../reports/construct-coverage.json');
const UPDATING_COVERAGE = !!process.env.UPDATE_CONSTRUCT_COVERAGE;

type Tier = 'expected-unreachable' | 'blocked' | 'ops-reachable' | 'traced';

const tracedTargets = new Set(
  fixtureFiles.map(
    file =>
      (JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, file), 'utf8')) as ConstructFixture).target
  )
);

const scenarios = (loadCorpus() as { id: string; dir: string }[])
  .slice()
  .sort((a, b) => a.id.localeCompare(b.id))
  .map(scenario => {
    const meta = JSON.parse(fs.readFileSync(path.join(scenario.dir, 'meta.json'), 'utf8')) as {
      expect?: { standard?: string };
    };
    const doc = JSON.parse(
      fs.readFileSync(path.join(scenario.dir, 'score.mnx.json'), 'utf8')
    ) as MnxStructure;
    // Blocking kinds are the ordering evidence for items 4–13: the kinds that
    // stand between today's vocabulary and this scenario existing at all.
    const blockedBy = [
      ...new Set(walkElements(doc).map(e => e.kind).filter(kind => !kindHasConstructOp(kind)))
    ].sort();
    const traced = tracedTargets.has(scenario.id);
    const tier: Tier =
      meta.expect?.standard === 'invalid'
        ? 'expected-unreachable'
        : traced
          ? 'traced'
          : blockedBy.length === 0
            ? 'ops-reachable'
            : 'blocked';
    return { id: scenario.id, tier, blockedBy, traced };
  });

const blockingKinds: Record<string, number> = {};
for (const scenario of scenarios)
  if (scenario.tier !== 'expected-unreachable')
    for (const kind of scenario.blockedBy) blockingKinds[kind] = (blockingKinds[kind] ?? 0) + 1;

const coverage = {
  note:
    'Generated by `npm run sweep:construct` (campaign item 3). Tiers are PREDICTIONS ' +
    'from the element inventory; `traced` is the only verdict, earned by a fixture that ' +
    'replays from {} and matches the goldens. A scenario listed as traced WITH blockedBy ' +
    'entries is not a contradiction — those elements are invisible to the primitives ' +
    'oracle (the engine draws the same default anyway), which is itself campaign data.',
  summary: {
    scenarios: scenarios.length,
    traced: scenarios.filter(s => s.tier === 'traced').length,
    opsReachable: scenarios.filter(s => s.tier === 'ops-reachable').length,
    blocked: scenarios.filter(s => s.tier === 'blocked').length,
    expectedUnreachable: scenarios.filter(s => s.tier === 'expected-unreachable').length
  },
  blockingKinds: Object.fromEntries(
    Object.entries(blockingKinds).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  ),
  scenarios: Object.fromEntries(
    scenarios.map(s => [
      s.id,
      s.blockedBy.length > 0 ? { tier: s.tier, blockedBy: s.blockedBy } : { tier: s.tier }
    ])
  )
};

if (UPDATING_COVERAGE) {
  fs.mkdirSync(path.dirname(COVERAGE_PATH), { recursive: true });
  fs.writeFileSync(COVERAGE_PATH, `${JSON.stringify(coverage, null, 2)}\n`);
}

describe('construct coverage (element-ops campaign item 3)', () => {
  it('the committed coverage report matches this run', () => {
    if (UPDATING_COVERAGE) return;
    expect(
      fs.existsSync(COVERAGE_PATH),
      `missing ${COVERAGE_PATH} — run npm run sweep:construct`
    ).toBe(true);
    expect(
      coverage,
      'construct coverage drifted from its committed report — if this is progress, run `npm run sweep:construct` and commit the diff'
    ).toEqual(JSON.parse(fs.readFileSync(COVERAGE_PATH, 'utf8')));
  });

  it('no trace targets an invalid-by-design scenario', () => {
    // The expected-unreachable class, enforced where it means something: the
    // ops must never be able to author a document the schema rejects. (The
    // per-fixture schema assertion above is the other half — a trace whose
    // replay is invalid fails outright.)
    const offenders = scenarios.filter(s => s.tier === 'expected-unreachable' && s.traced);
    expect(offenders.map(s => s.id), 'a construct trace builds an invalid document').toEqual([]);
  });

  it('every blocking kind is a real kind with no construct verb', () => {
    for (const kind of Object.keys(blockingKinds))
      expect(kindHasConstructOp(kind as never), `${kind} is listed as blocking`).toBe(false);
  });
});
