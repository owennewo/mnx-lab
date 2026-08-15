// Construct traces — the element-ops exemplar's FORWARD harness
// (roadmap/complete/core-element-ops-exemplar.md, campaign
// core-campaign-element-ops.md item 1).
//
// A fixture in harness/fixtures/construct-traces/ names a TARGET corpus
// scenario and an intent list. Replay starts from the literal empty document
// `{}` — genesis is ops (addPart materializes the skeleton), so every trace
// builds its own scaffolding. Four verdicts per fixture:
//
//   1. the replayed document introduces no schema error its TARGET does not
//      already carry — RELATIVE, because `schema: proposed` scenarios are
//      judged by a schema the harness cannot compile (final doc only: `{}` is
//      not valid MNX and needn't be, and mid-flight invalidity is normal)
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
import { ELEMENT_KINDS, kindHasConstructOp, walkElements } from '../../src/edit/elementWalk.ts';
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

/** Schema errors as comparable strings — the relative oracle asks whether the
 *  replay's set exceeds its TARGET's, never whether it is empty. */
function validationErrors(doc: MnxStructure): string[] {
  const validator = validateMnx as unknown as {
    (doc: unknown): boolean;
    errors?: { instancePath?: string; schemaPath?: string; message?: string }[] | null;
  };
  if (validator(doc)) return [];
  return (validator.errors ?? [])
    .map(e => `${e.instancePath || '/'} [${e.schemaPath}] ${e.message}`)
    .sort();
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

      const targetDoc = JSON.parse(
        fs.readFileSync(path.join(dir!, 'score.mnx.json'), 'utf8')
      ) as MnxStructure;

      // 1. Schema validity, RELATIVE to the target — the same widening item 2
      // made on the destruct side, and for the same reason the corpus has two
      // axes: a `schema: proposed` scenario is judged by a schema this repo
      // cannot compile (the published validator is the only one the harness
      // has), so an absolute assertion would make every proposal probe
      // untraceable. What must hold is that building it introduces no error
      // its own target does not already carry.
      const targetErrors = validationErrors(targetDoc);
      const replayErrors = validationErrors(session.doc);
      expect(
        replayErrors.filter(error => !targetErrors.includes(error)),
        'the replay introduced schema errors the target does not have'
      ).toEqual([]);

      // 4. THE VERDICT: primitives vs the committed golden, key-normalized
      // on both sides (golden: real ids; replay: any minted ids).
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
// (roadmap/complete/core-element-ops-construct-traces.md)
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

/**
 * The kinds this campaign is NOT going to build, and who owns them instead
 * (scoping decision, 2026-08-15).
 *
 * They cannot go in `expected-unreachable` — that class means "the ops must
 * never be able to author this", and a layout document is perfectly valid and
 * ought to be constructible one day. So the cut is made by naming an OWNER:
 * the tier stays `blocked` (no verb exists, which is true), and the report
 * stops implying the campaign owes it.
 */
const DEFERRED_KINDS: Record<string, string> = {
  layout: 'roadmap/proposed/core-layout-authoring.md',
  score: 'roadmap/proposed/core-layout-authoring.md',
  'multimeasure-rest': 'roadmap/proposed/core-layout-authoring.md',
  'kit-component': 'roadmap/proposed/core-percussion-kit.md',
  'kit-note': 'roadmap/proposed/core-percussion-kit.md',
  sound: 'roadmap/proposed/core-percussion-kit.md'
};

/**
 * A scenario today's ENTRY SURFACE cannot build: music in a second staff,
 * voice or part. The cursor reaches all three and every removal verb follows
 * it, but entry still writes to voice 0 of `parts[0]`, staff 1 — the policy
 * question that graduated out as `roadmap/proposed/core-entry-surface.md`.
 *
 * The queue has to know, because a trace is a keyboard performance: proposing
 * one for a grand staff would be proposing work nobody can do.
 */
function needsEntrySurface(id: string): boolean {
  const dir = dirById.get(id);
  if (!dir) return false;
  const doc = JSON.parse(fs.readFileSync(path.join(dir, 'score.mnx.json'), 'utf8')) as MnxStructure;
  const parts = doc.parts ?? [];
  if (parts.length > 1) return true;
  return parts.some(
    part =>
      (part.staves ?? 1) > 1 ||
      (part.measures ?? []).some(measure => (measure.sequences ?? []).length > 1)
  );
}

/**
 * THE TRACE BAR (scoping decision, 2026-08-15): kind coverage, not scenario
 * coverage.
 *
 * A trace is a recorded performance, so "trace all 89 reachable scenarios" is
 * ~1,276 elements of authoring — a project, not a closing item. The claim
 * worth making is the symmetric one to the destruct sweep: the sweep proves
 * every kind is REMOVABLE across the whole corpus, so the construct side
 * proves every kind with a verb has been BUILT at least once, from `{}`,
 * through the keyboard.
 *
 * It is reported rather than asserted while the queue drains — a hard
 * assertion today would redden the build for work nobody has done yet. The
 * committed numbers move only through `npm run sweep:construct`, so a new verb
 * arriving without a trace shows up as a deliberate diff. When `uncovered` is
 * empty, this becomes an assertion (and the note in the report says so).
 */
const constructibleKinds = [...new Set(Object.keys(ELEMENT_KINDS))]
  .filter(kind => kindHasConstructOp(kind as never))
  .sort();

const kindsOf = (id: string): Set<string> => {
  const dir = dirById.get(id);
  if (!dir) return new Set();
  const doc = JSON.parse(fs.readFileSync(path.join(dir, 'score.mnx.json'), 'utf8')) as MnxStructure;
  return new Set(walkElements(doc).map(e => e.kind).filter(kind => kindHasConstructOp(kind)));
};

const coveredKinds = new Set<string>();
for (const target of tracedTargets) for (const kind of kindsOf(target)) coveredKinds.add(kind);
const uncoveredKinds = constructibleKinds.filter(kind => !coveredKinds.has(kind));

/** The cheapest set of scenarios that would finish the cover: greedy on kinds
 *  gained per ELEMENT, so the queue prefers small documents — a trace's cost
 *  is roughly its element count, and a big scenario buys the same kinds at
 *  five times the authoring. Ties break by id, so the queue is stable. */
function traceQueue(): { scenario: string; elements: number; kinds: string[] }[] {
  const pool = new Map<string, Set<string>>();
  const size = new Map<string, number>();
  for (const scenario of scenarios) {
    if (scenario.tier === 'expected-unreachable' || scenario.traced) continue;
    if (scenario.blockedBy.some(kind => kind in DEFERRED_KINDS)) continue;
    if (needsEntrySurface(scenario.id)) continue;
    const kinds = kindsOf(scenario.id);
    pool.set(scenario.id, kinds);
    const dir = dirById.get(scenario.id)!;
    const doc = JSON.parse(fs.readFileSync(path.join(dir, 'score.mnx.json'), 'utf8')) as MnxStructure;
    size.set(scenario.id, walkElements(doc).length);
  }
  const need = new Set(uncoveredKinds);
  const queue: { scenario: string; elements: number; kinds: string[] }[] = [];
  while (need.size > 0) {
    let best: string | null = null;
    let bestScore = 0;
    for (const id of [...pool.keys()].sort()) {
      const gain = [...pool.get(id)!].filter(kind => need.has(kind)).length;
      if (gain === 0) continue;
      const score = gain / Math.max(size.get(id) ?? 1, 1);
      if (score > bestScore) [best, bestScore] = [id, score];
    }
    if (!best) break;
    const gained = [...pool.get(best)!].filter(kind => need.has(kind)).sort();
    queue.push({ scenario: best, elements: size.get(best) ?? 0, kinds: gained });
    gained.forEach(kind => need.delete(kind));
    pool.delete(best);
  }
  return queue;
}

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
    'oracle (the engine draws the same default anyway), which is itself campaign data. ' +
    '`traceCoverage` is THE BAR (2026-08-15): kind coverage, not scenario coverage — every ' +
    'kind with a construct verb built at least once from {}. Reported while the queue ' +
    'drains; when `uncovered` empties it becomes an assertion. `deferredKinds` are the ' +
    'kinds formally handed to another roadmap doc, so a `blocked` row with `deferredTo` ' +
    'is not this campaign\'s debt.',
  summary: {
    scenarios: scenarios.length,
    traced: scenarios.filter(s => s.tier === 'traced').length,
    opsReachable: scenarios.filter(s => s.tier === 'ops-reachable').length,
    blocked: scenarios.filter(s => s.tier === 'blocked').length,
    /** Blocked ONLY by kinds this campaign formally handed to another doc. */
    deferred: scenarios.filter(
      s => s.tier === 'blocked' && s.blockedBy.every(kind => kind in DEFERRED_KINDS)
    ).length,
    expectedUnreachable: scenarios.filter(s => s.tier === 'expected-unreachable').length
  },
  /** THE BAR: every kind with a construct verb, built at least once from {}. */
  traceCoverage: {
    kindsWithAVerb: constructibleKinds.length,
    covered: constructibleKinds.length - uncoveredKinds.length,
    uncovered: uncoveredKinds,
    /** Uncovered kinds whose every corpus home needs a second staff, voice or
     *  part — coverable only once `core-entry-surface.md` lands, so the bar
     *  closes when `uncovered` is a subset of THIS, not when it is empty. */
    awaitingEntrySurface: uncoveredKinds.filter(kind =>
      scenarios
        .filter(s => s.tier !== 'expected-unreachable' && kindsOf(s.id).has(kind))
        .every(s => needsEntrySurface(s.id))
    ),
    queue: traceQueue()
  },
  deferredKinds: DEFERRED_KINDS,
  blockingKinds: Object.fromEntries(
    Object.entries(blockingKinds).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  ),
  scenarios: Object.fromEntries(
    scenarios.map(s => {
      const owners = [
        ...new Set(s.blockedBy.map(kind => DEFERRED_KINDS[kind]).filter(Boolean))
      ].sort();
      return [
        s.id,
        {
          tier: s.tier,
          ...(s.blockedBy.length > 0 ? { blockedBy: s.blockedBy } : {}),
          // Every blocking kind handed away? Then this scenario is not the
          // campaign's debt, and the report says whose it is.
          ...(s.blockedBy.length > 0 && s.blockedBy.every(kind => kind in DEFERRED_KINDS)
            ? { deferredTo: owners }
            : {})
        }
      ];
    })
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

  it('nothing is blocked without an owner', () => {
    // The scoping decision as a test: a kind with no construct verb is either
    // this campaign's work (and appears in the trace queue's denominator) or
    // formally another doc's (and names it). A NEW verbless kind arriving
    // unowned fails here rather than sitting in the report looking finished.
    const orphans = scenarios
      .filter(s => s.tier === 'blocked')
      .filter(s => !s.blockedBy.every(kind => kind in DEFERRED_KINDS))
      .map(s => s.id);
    expect(orphans, 'blocked by a kind no doc owns').toEqual([]);
  });

  it('every deferred kind names a roadmap doc that exists', () => {
    for (const [kind, owner] of Object.entries(DEFERRED_KINDS))
      expect(
        fs.existsSync(path.join(__dirname, '../..', owner)),
        `${kind} defers to a missing ${owner}`
      ).toBe(true);
  });

  it('THE BAR: every kind with a construct verb has been built from {} at least once', () => {
    // The closing condition, now an assertion rather than a report (campaign
    // item 3, decision 5): the queue is empty and `uncovered` holds nothing
    // but the kinds waiting on `core-entry-surface.md`. A verb landing without
    // a trace reddens the build from here on, which is the whole point of
    // having named a bar.
    expect(
      uncoveredKinds.filter(
        kind => !coverage.traceCoverage.awaitingEntrySurface.includes(kind)
      ),
      'a construct verb exists for this kind and no trace has ever built one'
    ).toEqual([]);
  });

  it('the queue plus the entry-surface wait accounts for every uncovered kind', () => {
    // Nothing may sit uncovered without a reason: either a queued trace will
    // cover it, or its only homes need an entry surface this campaign does not
    // own. A third case would be a hole in the bar.
    const queued = new Set(traceQueue().flatMap(row => row.kinds));
    const awaiting = new Set(coverage.traceCoverage.awaitingEntrySurface);
    expect(
      uncoveredKinds.filter(kind => !queued.has(kind) && !awaiting.has(kind)),
      'uncovered, unqueued, and not waiting on anything'
    ).toEqual([]);
  });

  it('a kind waits on the entry surface only if EVERY home needs it', () => {
    for (const kind of coverage.traceCoverage.awaitingEntrySurface) {
      const homes = scenarios.filter(
        s => s.tier !== 'expected-unreachable' && kindsOf(s.id).has(kind)
      );
      expect(homes.length, `${kind} has no corpus home at all`).toBeGreaterThan(0);
      expect(
        homes.filter(s => !needsEntrySurface(s.id)).map(s => s.id),
        `${kind} has a single-staff home and should be queued, not waiting`
      ).toEqual([]);
    }
  });

  it('the trace queue would finish the cover', () => {
    // The bar is reported, not asserted, while the queue drains — but the
    // QUEUE itself must be complete, or the campaign would be reading a work
    // list that cannot reach the claim it promises.
    const reached = new Set([...coveredKinds, ...coverage.traceCoverage.awaitingEntrySurface]);
    for (const row of traceQueue()) row.kinds.forEach(kind => reached.add(kind));
    expect(constructibleKinds.filter(kind => !reached.has(kind))).toEqual([]);
  });

  it('every blocking kind is a real kind with no construct verb', () => {
    for (const kind of Object.keys(blockingKinds))
      expect(kindHasConstructOp(kind as never), `${kind} is listed as blocking`).toBe(false);
  });
});
