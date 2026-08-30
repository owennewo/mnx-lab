// The destructibility sweep — the element-ops campaign's reverse harness at
// corpus scale (item 2, roadmap/complete/core-element-ops-destruct-sweep.md;
// item 1 proved the algorithm over two scenarios in
// roadmap/complete/core-element-ops-exemplar.md).
//
// No fixtures: the walk regenerates every run. For each of the 106 scenarios,
// enumerate every element (src/edit/elementWalk.ts — the ink census join in
// element-census.test.ts is what keeps that enumeration honest) and, each from
// a FRESH session loaded history-less as documents really arrive:
//
//   1. ADDRESS it with cursor navigation only — an element the cursor cannot
//      reach is a finding, not a skip
//   2. remove it (the Delete intent)
//   3. when something was removed, judge it against the oracles below
//
// TWO AXES, one red. `unaddressable` is a ladder gap and `no-op` is a
// vocabulary gap: both are the campaign's scoreboard, recorded in the report
// and reviewed as a diff. Only `broken` — a removal that happened and violated
// an invariant — fails the build, which is what lets this sweep run from the
// day the corpus is mostly not destructible yet.
//
// The oracles (item 1's five, widened by item 2):
//   applies          the document changed
//   validity         RELATIVE: the schema error set must not GROW (five
//                    scenarios are invalid by design and must stay judgeable)
//   diagnostics      no renderer diagnostics beyond the untouched baseline
//   references       RELATIVE: no reference dangles, and none goes inkless —
//                    an emptied event keeps its id, so a beam does not dangle,
//                    it beams a rest (src/model/references.ts)
//   undo             undo-all restores the loaded document byte-identically
//   surviving doc    everything outside the element and its DECLARED cascades
//                    is untouched — the no-tombstone rule made mechanical
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { EditorSession } from '../../src/edit/session.ts';
import { attemptElement, elementKeys, driveToElement, kindHasRemovalOp, runDestructWalk }
  from '../../src/edit/destructWalk.ts';
import { walkElements, type ElementRef } from '../../src/edit/elementWalk.ts';
import { findBrokenReferences } from '../../src/model/references.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { computePrimitives } from '../helpers/corpusPrimitives.ts';
import { diffDocuments, pathString, pathWithin, type DocChange } from '../helpers/docDiff.ts';
import validateMnx from '../../worker/generated/validate-mnx.mjs';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus } from '../verify/check-scenarios.mjs';

const REPORT_PATH = path.join(
  path.dirname(path.dirname(new URL(import.meta.url).pathname)),
  'reports',
  'destruct-sweep.json'
);
const UPDATING = !!process.env.UPDATE_DESTRUCT_SWEEP;
const EXEMPLARS = ['lab/document/minimal-single-note', 'lab/tab-positions/open-strings-chord'];

interface Scenario { id: string; dir: string }
const corpus = (loadCorpus() as Scenario[]).slice().sort((a, b) => a.id.localeCompare(b.id));

// ---------------------------------------------------------------- the oracles

/** Diagnostic-badge count across both projections; layout crashes count as
 *  unavailable rather than zero, so a crash can never read as "clean". */
function diagnosticCount(doc: MnxStructure): number | null {
  try {
    const prims = computePrimitives(doc);
    const count = (list: { className?: string }[] | undefined) =>
      (list ?? []).filter(p => p.className?.includes('diagnostic-marker')).length;
    return count(prims.notation.primitives) + count(prims.tab?.primitives);
  } catch {
    return null;
  }
}

/** Schema errors as comparable strings — the relative-validity oracle asks
 *  whether this set GREW, never whether it is empty. */
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

function brokenReferenceKeys(doc: MnxStructure): string[] {
  return findBrokenReferences(doc)
    .map(ref => `${ref.from} ${ref.kind}→${ref.target} (${ref.reason})`)
    .sort();
}

/** New members of `after` that were not in `before` — every oracle here is
 *  relative, because corpus documents are allowed to arrive imperfect. */
function newlyPresent(before: string[], after: string[]): string[] {
  const counts = new Map<string, number>();
  for (const key of before) counts.set(key, (counts.get(key) ?? 0) + 1);
  const fresh: string[] = [];
  for (const key of after) {
    const count = counts.get(key) ?? 0;
    if (count > 0) counts.set(key, count - 1);
    else fresh.push(key);
  }
  return fresh;
}

/**
 * The surviving-document oracle. A change is allowed when it is:
 *   - inside the array the element lived in (splicing shifts its siblings), or
 *   - the containing event swapping `notes` for `rest` (an emptied event is a
 *     rest of the same duration — the declared cascade of `deleteNote`), or
 *   - a pure disappearance whose every departing value NAMED something we just
 *     removed (the reference cascade: unlinking both ends).
 * Anything else is a tombstone or collateral damage, and fails.
 */
function unexplainedChanges(
  changes: DocChange[],
  element: ElementRef,
  removedIds: string[]
): DocChange[] {
  const container = element.jsonPath.slice(0, -1); // the array the element sat in
  const event = element.jsonPath.slice(0, -2); // …/content/<e>  for …/notes/<n>
  return changes.filter(change => {
    if (pathWithin(change.path, container)) return false;
    // The ANCESTOR COLLAPSE: emptying a container removes it outright — no
    // tombstone `ties: []` on the note, no `_x: {mnxLab: {}}` on the part — and
    // that can cascade up several levels. Allowed only along the element's own
    // ancestor chain, and only when the vanished key is the very segment the
    // element sits under, so a SIBLING can never be excused this way.
    for (let depth = element.jsonPath.length - 1; depth >= 0; depth--) {
      if (pathString(change.path) !== pathString(element.jsonPath.slice(0, depth))) continue;
      const segment = String(element.jsonPath[depth]);
      if (change.added.length === 0 && change.removed.every(entry => entry.startsWith(`${segment}=`)))
        return false;
    }
    // The declared cascade of emptying an event: it becomes a rest of the
    // same duration, and the ink-bound things it carried go with its ink — a
    // rest does not slur.
    if (
      element.kind === 'note' &&
      pathString(change.path) === pathString(event) &&
      change.added.every(entry => entry.startsWith('rest=')) &&
      change.removed.every(entry => entry.startsWith('notes=') || entry.startsWith('slurs='))
    )
      return false;
    if (
      change.added.length === 0 &&
      change.removed.length > 0 &&
      change.removed.every(entry => removedIds.some(id => id && entry.includes(`"${id}"`)))
    )
      return false;

    return true;
  });
}

// ------------------------------------------------------------------ the sweep

type Verdict = 'removed' | 'no-op' | 'refused' | 'broken';

interface ElementResult {
  path: string;
  kind: string;
  address: 'addressed' | 'unaddressable';
  verdict: Verdict;
  failures?: string[];
}

interface ScenarioResult {
  id: string;
  elements: ElementResult[];
}

/** The id of the note being removed, plus the id of the event it empties —
 *  the two things a reference cascade is allowed to have been pointing at. */
function removedIds(doc: MnxStructure, element: ElementRef): string[] {
  const at = (jsonPath: (string | number)[]): unknown =>
    jsonPath.reduce<unknown>(
      (node, segment) => (node as Record<string | number, unknown> | undefined)?.[segment],
      doc
    );
  const note = at(element.jsonPath) as { id?: string } | undefined;
  const event = at(element.jsonPath.slice(0, -2)) as { id?: string; notes?: unknown[] } | undefined;
  const ids = [note?.id];
  if (event && (event.notes?.length ?? 0) <= 1) ids.push(event.id);
  return ids.filter((id): id is string => !!id);
}

function sweepScenario(scenario: Scenario): ScenarioResult {
  const loaded = JSON.parse(
    fs.readFileSync(path.join(scenario.dir, 'document.mnx.json'), 'utf8')
  ) as MnxStructure;
  const loadedBytes = JSON.stringify(loaded);
  const baseline = {
    diagnostics: diagnosticCount(loaded),
    errors: validationErrors(loaded),
    broken: brokenReferenceKeys(loaded)
  };

  const elements = walkElements(loaded).map<ElementResult>(element => {
    const session = new EditorSession(JSON.parse(loadedBytes) as MnxStructure, scenario.id);
    const before = JSON.parse(loadedBytes) as MnxStructure;
    const ids = removedIds(before, element);
    const attempt = attemptElement(session, element);
    const row: ElementResult = {
      path: element.path,
      kind: element.kind,
      address: attempt.address,
      verdict: attempt.removal
    };
    if (attempt.removal !== 'removed') return row;

    const failures: string[] = [];
    const after = session.doc;
    if (JSON.stringify(after) === loadedBytes) failures.push('the document did not change');

    // THE IDENTITY ORACLE: did the removal take THIS element? A verb can change
    // the document and still leave the thing you aimed at — a beam key that
    // peels the innermost level removes a nested beam while the outer one, also
    // starting at that note, stays. Without this, the report would count it
    // removed and the ink would still be on the page.
    const at = (doc: unknown, jsonPath: (string | number)[]): unknown =>
      jsonPath.reduce<unknown>(
        (node, segment) => (node as Record<string | number, unknown> | undefined)?.[segment],
        doc
      );
    const stillThere =
      JSON.stringify(at(before, element.jsonPath)) === JSON.stringify(at(after, element.jsonPath));
    if (stillThere) {
      // Not a failure — the verb declined this one. `refused` says so.
      row.verdict = 'refused';
      return row;
    }

    const freshErrors = newlyPresent(baseline.errors, validationErrors(after));
    if (freshErrors.length) failures.push(`new schema errors: ${freshErrors.slice(0, 2).join('; ')}`);

    const diagnostics = diagnosticCount(after);
    if (diagnostics === null) failures.push('layout crashed after removal');
    else if (baseline.diagnostics !== null && diagnostics > baseline.diagnostics)
      failures.push(`diagnostics ${baseline.diagnostics} → ${diagnostics}`);

    const freshBroken = newlyPresent(baseline.broken, brokenReferenceKeys(after));
    if (freshBroken.length) failures.push(`broken references: ${freshBroken.join('; ')}`);

    const unexplained = unexplainedChanges(diffDocuments(before, after), element, ids);
    if (unexplained.length)
      failures.push(
        `unexplained changes at ${unexplained
          .slice(0, 2)
          .map(c => `${pathString(c.path) || '/'} (-${c.removed.length}/+${c.added.length})`)
          .join(', ')}`
      );

    while (session.canUndo) session.handleIntent({ type: 'undo' });
    if (JSON.stringify(session.doc) !== loadedBytes) failures.push('undo did not restore the document');

    if (failures.length) {
      row.verdict = 'broken';
      row.failures = failures;
    }
    return row;
  });

  return { id: scenario.id, elements };
}

const results: ScenarioResult[] = corpus.map(sweepScenario);

// ----------------------------------------------------------------- the report

type VerdictCounts = Partial<Record<Verdict, number>>;

function tally(rows: ElementResult[], key: (row: ElementResult) => string): Record<string, VerdictCounts> {
  const out: Record<string, VerdictCounts> = {};
  for (const row of rows.slice().sort((a, b) => key(a).localeCompare(key(b)))) {
    const bucket = (out[key(row)] ??= {});
    bucket[row.verdict] = (bucket[row.verdict] ?? 0) + 1;
  }
  return out;
}

const allRows = results.flatMap(r => r.elements);

/**
 * Findings = everything a human should look at. Deliberately NOT every
 * unaddressable element: a clef nobody can select is implied by its `no-op`
 * row, and listing thousands of them would bury the real content. An
 * unaddressable NOTE is listed, because a removal verb exists for its kind and
 * only the ladder is in the way.
 */
const findings = results.flatMap(result =>
  result.elements
    .filter(
      row =>
        row.verdict === 'broken' ||
        (row.address === 'unaddressable' && kindHasRemovalOp(row.kind as never))
    )
    .map(row => ({
      scenario: result.id,
      element: row.path,
      kind: row.kind,
      verdict: row.verdict === 'broken' ? 'broken' : 'unaddressable',
      ...(row.failures ? { failures: row.failures } : {})
    }))
);

const report = {
  note:
    'Generated by `npm run sweep:destruct` (campaign item 2). Rollups + findings only — ' +
    'the per-element detail regenerates on every run, so committing it would be churn. ' +
    'A diff here is the campaign making progress: rows move no-op → removed as items land.',
  summary: {
    scenarios: results.length,
    elements: allRows.length,
    verdicts: tally(allRows, () => 'all')['all'],
    unaddressableWithAnOp: findings.filter(f => f.verdict === 'unaddressable').length
  },
  kinds: tally(allRows, row => row.kind),
  scenarios: Object.fromEntries(
    results.map(result => [result.id, tally(result.elements, row => row.kind)])
  ),
  findings
};

if (UPDATING) {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
}

// ------------------------------------------------------------------ the tests

describe('destruct sweep (element-ops campaign item 2)', () => {
  for (const result of results) {
    it(`${result.id}: no removal breaks an invariant`, () => {
      const broken = result.elements.filter(row => row.verdict === 'broken');
      expect(
        broken.map(row => `${row.path}: ${row.failures?.join(' / ')}`),
        'a removal applied and violated an oracle'
      ).toEqual([]);
    });
  }

  it('the committed report matches this run', () => {
    if (UPDATING) return;
    expect(fs.existsSync(REPORT_PATH), `missing ${REPORT_PATH} — run npm run sweep:destruct`).toBe(true);
    const committed = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
    expect(
      report,
      'the sweep drifted from its committed report — if this is progress, run `npm run sweep:destruct` and commit the diff'
    ).toEqual(committed);
  });

  it('enumerates more elements than the entry surface can name', () => {
    // The gap between the two enumerations is the campaign's remaining work;
    // if it ever closes, this sweep has done its job and the assertion flips.
    const notes = allRows.filter(row => row.kind === 'note');
    expect(notes.length).toBeGreaterThan(0);
    expect(allRows.length).toBeGreaterThan(notes.length);
  });

  // Item 1's exhaustive pass, kept verbatim: the two exemplars must still tear
  // down to the literal {} in either order, with byte-identical undo-all.
  for (const id of EXEMPLARS) {
    it(`${id}: two orders commute, teardown reaches {}`, () => {
      const dir = corpus.find(s => s.id === id)?.dir;
      const loadedBytes = fs.readFileSync(path.join(dir!, 'document.mnx.json'), 'utf8');
      const loaded = JSON.stringify(JSON.parse(loadedBytes));
      const terminals = [false, true].map(reversed => {
        const session = new EditorSession(JSON.parse(loaded) as MnxStructure, id);
        for (let guard = 0; elementKeys(session.doc).length > 0 && guard < 64; guard++) {
          const remaining = elementKeys(session.doc);
          const key = reversed ? remaining[remaining.length - 1] : remaining[0];
          expect(driveToElement(session, key), `cursor cannot address ${key}`).toBe(true);
          expect(session.handleIntent({ type: 'delete' })).toBe(true);
        }
        expect(elementKeys(session.doc)).toEqual([]);
        expect(validateMnx(session.doc)).toBe(true);
        runDestructWalk(session);
        expect(JSON.stringify(session.doc)).toBe('{}');
        while (session.canUndo) session.handleIntent({ type: 'undo' });
        expect(JSON.stringify(session.doc)).toBe(loaded);
        return session.doc;
      });
      expect(terminals[0]).toEqual(terminals[1]);
    });
  }
});
