// Construct traces — the element-ops exemplar's FORWARD harness
// (roadmap/inprogress/core-element-ops-exemplar.md, campaign
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
