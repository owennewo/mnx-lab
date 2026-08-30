import { describe, expect, it } from 'vitest';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { EditorSession, replayIntents } from '../../src/edit/session.ts';
import type { SelectionLevel } from '../../src/edit/selection.ts';
import {
  MemorySelectionClipboardStore,
  type SelectionClipboardStore
} from '../../src/edit/selectionClipboard.ts';
import { cutSelectionToStore } from '../../src/edit/selectionClipboardActions.ts';
import { planSelectionCut } from '../../src/edit/selectionCutPlanner.ts';
import { decodeSelectionClip } from '../../src/edit/selectionClip.ts';
import validateMnxProposed from '../../worker/generated/validate-mnx-proposed.mjs';

function event(id: string, step: 'C' | 'D' | 'E' | 'F' = 'C', chord = false) {
  return {
    id,
    duration: { base: 'quarter' as const },
    notes: [
      { id: `${id}-n1`, pitch: { step, octave: 4 } },
      ...(chord ? [{ id: `${id}-n2`, pitch: { step: 'E' as const, octave: 4 } }] : [])
    ]
  };
}

function score(): MnxStructure {
  return {
    mnx: { version: 1, support: { useBeams: true } },
    global: {
      measures: [
        { id: 'm0', section: { label: 'A' } },
        { id: 'm1' },
        { id: 'm2', section: { label: 'B' } }
      ]
    },
    parts: [
      {
        id: 'p1',
        name: 'Upper',
        staves: 2,
        measures: [
          {
            clefs: [
              { clef: { sign: 'G', staffPosition: -2 }, staff: 1 },
              { clef: { sign: 'F', staffPosition: 2 }, staff: 2 }
            ],
            dynamics: [
              { position: { fraction: [0, 1] }, type: 'immediate', value: 'f', staff: 1 },
              { position: { fraction: [0, 1] }, type: 'immediate', value: 'p', staff: 2 }
            ],
            sequences: [
              { voice: 'upper', content: [event('e0', 'C', true)] },
              { staff: 2, voice: 'lower', content: [event('lower0', 'D')] }
            ]
          },
          {
            ottavas: [{
              position: { fraction: [0, 1] },
              end: { measure: 'm1', position: { fraction: [1, 4] } },
              value: 1
            }],
            sequences: [
              { voice: 'upper', content: [event('e1', 'D')] },
              { staff: 2, voice: 'lower', content: [event('lower1', 'E')] }
            ]
          },
          {
            sequences: [
              { voice: 'upper', content: [event('e2', 'E')] },
              { staff: 2, voice: 'lower', content: [event('lower2', 'F')] }
            ]
          }
        ]
      },
      {
        id: 'p2',
        name: 'Other',
        measures: [
          { sequences: [{ content: [event('p2e0')] }] },
          { sequences: [{ content: [event('p2e1')] }] },
          { sequences: [{ content: [event('p2e2')] }] }
        ]
      }
    ],
    layouts: [
      {
        id: 'ensemble',
        content: [
          { type: 'staff', sources: [{ part: 'p1' }] },
          { type: 'staff', sources: [{ part: 'p2' }] }
        ]
      },
      { id: 'only-p1', content: [{ type: 'staff', sources: [{ part: 'p1' }] }] }
    ],
    scores: [
      {
        name: 'Part score',
        layout: 'only-p1',
        pages: [{ systems: [{ measure: 'm1' }, { measure: 'm2' }] }],
        multimeasureRests: [{ start: 'm0', duration: 3 }]
      }
    ]
  };
}

function containerScore(kind: 'tuplet' | 'grace' = 'tuplet'): MnxStructure {
  const container = kind === 'tuplet'
    ? {
        type: 'tuplet' as const,
        inner: { duration: { base: 'eighth' as const }, multiple: 2 },
        outer: { duration: { base: 'eighth' as const }, multiple: 1 },
        content: [event('inner1'), event('inner2', 'D')]
      }
    : {
        type: 'grace' as const,
        content: [event('grace1')]
      };
  return {
    mnx: { version: 1 },
    global: { measures: [{ id: 'cm0' }] },
    parts: [{ measures: [{ sequences: [{ content: [container, event('after')] }] }] }]
  };
}

function relaxTo(session: EditorSession, level: SelectionLevel): void {
  for (let guard = 0; session.selectionLevel !== level && guard < 8; guard++) {
    expect(session.handleIntent({ type: 'relaxSelection' })).toBe(true);
  }
  expect(session.selectionLevel).toBe(level);
}

function selectedSession(level: SelectionLevel, doc = score(), closure = false): EditorSession {
  const session = new EditorSession(doc);
  relaxTo(session, level);
  if (closure) expect(session.handleIntent({ type: 'closeSelection' })).toBe(true);
  return session;
}

function accepted(session: EditorSession) {
  const result = planSelectionCut(session.doc, session.selection, session.projection);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.message);
  expect(validateMnxProposed(result.document), JSON.stringify(validateMnxProposed.errors)).toBe(true);
  return result;
}

describe('selection cut', () => {
  it('removes each supported rung as one history entry with selection-aware undo/redo', async () => {
    const cases: Array<{
      level: SelectionLevel;
      doc?: MnxStructure;
      closure?: boolean;
      kind: string;
    }> = [
      { level: 'note', kind: 'note-set' },
      { level: 'event', kind: 'event-run' },
      { level: 'voiceMeasure', kind: 'voice-bars' },
      { level: 'partMeasure', kind: 'part-bars' },
      { level: 'partMeasure', closure: true, kind: 'part' },
      { level: 'measure', kind: 'measures' }
    ];
    for (const item of cases) {
      const session = selectedSession(item.level, item.doc ?? score(), item.closure);
      const initial = JSON.stringify(session.doc);
      const selectionBefore = session.selection;
      const store = new MemorySelectionClipboardStore();
      const result = await cutSelectionToStore(session, store);
      expect(result.ok, `${item.kind} refused`).toBe(true);
      if (!result.ok) continue;
      expect(result.plan.clipKind).toBe(item.kind);
      expect(session.appliedOps.map(op => op.type)).toEqual(['cutSelection']);
      expect(JSON.stringify(session.doc)).not.toBe(initial);
      expect(decodeSelectionClip((await store.read())!).clip.kind).toBe(item.kind);
      const selectionAfter = session.selection;

      expect(session.handleIntent({ type: 'undo' })).toBe(true);
      expect(JSON.stringify(session.doc)).toBe(initial);
      expect(session.selection).toEqual(selectionBefore);
      expect(session.handleIntent({ type: 'redo' })).toBe(true);
      expect(session.selection).toEqual(selectionAfter);
      expect(session.appliedOps).toHaveLength(1);
    }
  });

  it('uses rung-specific removal semantics and repairs owned structure', () => {
    const note = accepted(selectedSession('note'));
    const noteEvent = note.document.parts[0].measures[0].sequences[0].content[0];
    expect('notes' in noteEvent ? noteEvent.notes : []).toHaveLength(1);

    const eventCut = accepted(selectedSession('event'));
    expect(eventCut.document.parts[0].measures[0].sequences[0].content[0])
      .toMatchObject({ duration: { base: 'quarter' }, rest: {} });

    const voice = accepted(selectedSession('voiceMeasure'));
    expect(voice.document.parts[0].measures[0].sequences.map(sequence => sequence.staff))
      .toEqual([2]);

    // The part-bar member covers EVERY staff (core-selection-range-grain.md
    // decision 4): the cut empties the whole bar, both staves' declarations
    // included.
    const partBar = accepted(selectedSession('partMeasure'));
    const partBarMeasure = partBar.document.parts[0].measures[0];
    expect(partBarMeasure.sequences).toEqual([]);
    expect(partBarMeasure.clefs).toBeUndefined();
    expect(partBarMeasure.dynamics).toBeUndefined();

    const part = accepted(selectedSession('partMeasure', score(), true));
    expect(part.document.parts.map(candidate => candidate.id)).toEqual(['p2']);
    expect(part.document.layouts).toEqual([{
      id: 'ensemble',
      content: [{ type: 'staff', sources: [{ part: 'p2' }] }]
    }]);
    expect(part.document.scores?.[0].layout).toBeUndefined();
  });

  it('removes staff-owned beams with their staff material, not as detached references', () => {
    const doc = score();
    doc.parts[0].measures[0].sequences[0].content = [
      { id: 'beamed-1', duration: { base: 'eighth' }, notes: [{ id: 'beamed-1-n', pitch: { step: 'C', octave: 4 } }] },
      { id: 'beamed-2', duration: { base: 'eighth' }, notes: [{ id: 'beamed-2-n', pitch: { step: 'D', octave: 4 } }] }
    ];
    doc.parts[0].measures[0].beams = [{ events: ['beamed-1', 'beamed-2'] }];
    const result = accepted(selectedSession('partMeasure', doc));
    expect(result.document.parts[0].measures[0].beams).toBeUndefined();
    expect(result.detachedTargetReferences).toBe(0);
  });

  it('closes the timeline and repairs id/count-based measure references', () => {
    const session = new EditorSession(score());
    expect(session.handleIntent({ type: 'goToMeasure', measureIndex: 1 })).toBe(true);
    relaxTo(session, 'measure');
    const result = accepted(session);
    expect(result.document.global.measures.map(measure => measure.id)).toEqual(['m0', 'm2']);
    expect(result.document.parts.every(part => part.measures.length === 2)).toBe(true);
    expect(result.document.parts[0].measures.flatMap(measure => measure.ottavas ?? [])).toEqual([]);
    expect(result.document.scores?.[0].pages?.[0].systems).toEqual([{ measure: 'm2' }]);
    expect(result.document.scores?.[0].multimeasureRests).toEqual([{ start: 'm0', duration: 2 }]);
  });

  it('writes before mutation, and a failed or stale write leaves history and document untouched', async () => {
    const failed = selectedSession('event');
    const failedDoc = JSON.stringify(failed.doc);
    const rejecting: SelectionClipboardStore = {
      async write() {
        expect(failed.appliedOps).toEqual([]);
        throw new Error('store unavailable');
      },
      async read() { return null; }
    };
    expect(await cutSelectionToStore(failed, rejecting)).toEqual({
      ok: false,
      code: 'clipboard-write-failed',
      message: 'store unavailable'
    });
    expect(JSON.stringify(failed.doc)).toBe(failedDoc);
    expect(failed.appliedOps).toEqual([]);

    const stale = selectedSession('event');
    const staleDoc = JSON.stringify(stale.doc);
    let written = '';
    const moving: SelectionClipboardStore = {
      async write(value) {
        written = value;
        stale.handleIntent({ type: 'nextPosition' });
      },
      async read() { return written || null; }
    };
    expect(await cutSelectionToStore(stale, moving)).toMatchObject({
      ok: false,
      code: 'stale-session'
    });
    expect(JSON.stringify(stale.doc)).toBe(staleDoc);
    expect(stale.appliedOps).toEqual([]);
    expect(decodeSelectionClip(written).clip.kind).toBe('event-run');
  });

  it('records the materialized cut result and never reads clipboard state during replay', async () => {
    const initial = score();
    const session = selectedSession('event', initial);
    const store = new MemorySelectionClipboardStore();
    expect((await cutSelectionToStore(session, store)).ok).toBe(true);
    const trace = session.trace();
    expect(trace.intents.find(intent => intent.type === 'applyCutPlan')).toMatchObject({
      type: 'applyCutPlan',
      plan: { ok: true, clipKind: 'event-run', document: session.doc }
    });
    await store.write('changed later');
    const replay = replayIntents(initial, trace.intents);
    expect(replay.doc).toEqual(session.doc);
    expect(replay.selection).toEqual(session.selection);
  });

  it('keeps score cut unavailable and does not overwrite the store', async () => {
    const session = selectedSession('document');
    const store = new MemorySelectionClipboardStore();
    await store.write('keep me');
    expect(await cutSelectionToStore(session, store)).toMatchObject({
      ok: false,
      code: 'score-unavailable'
    });
    expect(await store.read()).toBe('keep me');
    expect(session.appliedOps).toEqual([]);
  });
});
