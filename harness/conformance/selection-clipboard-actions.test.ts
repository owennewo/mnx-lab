import { describe, expect, it } from 'vitest';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { MemorySelectionClipboardStore } from '../../src/edit/selectionClipboard.ts';
import {
  copySelectionToStore,
  pasteSelectionFromStore
} from '../../src/edit/selectionClipboardActions.ts';
import { EditorSession, replayIntents } from '../../src/edit/session.ts';
import type { SelectionLevel } from '../../src/edit/selection.ts';

function score(prefix: string, source = false): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{}] },
    parts: [{
      measures: [{
        sequences: [{
          content: [
            {
              id: `${prefix}-event-1`,
              duration: { base: 'quarter' },
              notes: [{ id: `${prefix}-note-1`, pitch: { step: source ? 'E' : 'C', octave: 4 } }]
            },
            {
              id: `${prefix}-event-2`,
              duration: { base: 'quarter' },
              notes: [{ id: `${prefix}-note-2`, pitch: { step: source ? 'F' : 'D', octave: 4 } }]
            }
          ]
        }]
      }]
    }]
  };
}

function selectAllEvents(session: EditorSession): void {
  expect(session.handleIntent({ type: 'relaxSelection' })).toBe(true);
  expect(session.selectionLevel).toBe('event');
  expect(session.handleIntent({ type: 'closeSelection' })).toBe(true);
}

function selectFirstEvent(session: EditorSession): void {
  expect(session.handleIntent({ type: 'relaxSelection' })).toBe(true);
  expect(session.selectionLevel).toBe('event');
}

function relaxTo(session: EditorSession, level: SelectionLevel): void {
  for (let guard = 0; session.selectionLevel !== level && guard < 8; guard++) {
    expect(session.handleIntent({ type: 'relaxSelection' })).toBe(true);
  }
  expect(session.selectionLevel).toBe(level);
}

function emptyScore(): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{}] },
    parts: [{ measures: [{ sequences: [] }] }]
  };
}

function halfNoteScore(prefix: string): MnxStructure {
  const doc = score(prefix);
  doc.parts[0].measures[0].sequences[0].content = [{
    id: `${prefix}-event-half`,
    duration: { base: 'half' },
    notes: [{ id: `${prefix}-note-half`, pitch: { step: 'C', octave: 4 } }]
  }];
  return doc;
}

describe('app-scoped selection clipboard actions', () => {
  it('copies between sessions, commits one atomic op, and restores both selection snapshots', async () => {
    const store = new MemorySelectionClipboardStore();
    const source = new EditorSession(score('source', true));
    // A point on one half-note is replaced by two quarter-note events. The
    // landing therefore has to come from pasted material, not target members.
    const targetInitial = halfNoteScore('target');
    const target = new EditorSession(targetInitial);
    selectAllEvents(source);
    selectFirstEvent(target);
    const priorSelection = target.selection;

    const copied = await copySelectionToStore(source, store);
    expect(copied).toMatchObject({ ok: true, envelope: { clip: { kind: 'event-run' } } });
    const pasted = await pasteSelectionFromStore(target, store);
    expect(pasted.ok).toBe(true);
    expect(target.appliedOps.map(op => op.type)).toEqual(['pasteSelection']);
    expect(target.selectionLevel).toBe('event');
    expect(target.resolvedSelection.members).toHaveLength(2);
    expect(target.doc.parts[0].measures[0].sequences[0].content)
      .toMatchObject([
        { notes: [{ pitch: { step: 'E' } }] },
        { notes: [{ pitch: { step: 'F' } }] }
      ]);
    const pastedSelection = target.selection;

    expect(target.handleIntent({ type: 'undo' })).toBe(true);
    expect(target.selection).toEqual(priorSelection);
    expect(target.doc).toEqual(targetInitial);
    expect(target.handleIntent({ type: 'redo' })).toBe(true);
    expect(target.selection).toEqual(pastedSelection);
    expect(target.resolvedSelection.members).toHaveLength(2);
  });

  it('records the materialized plan, so replay is independent of later clipboard state', async () => {
    const store = new MemorySelectionClipboardStore();
    const source = new EditorSession(score('source', true));
    const targetInitial = score('target');
    const target = new EditorSession(targetInitial);
    selectAllEvents(source);
    selectFirstEvent(target);
    await copySelectionToStore(source, store);
    expect((await pasteSelectionFromStore(target, store)).ok).toBe(true);

    const trace = target.trace();
    const pasteIntent = trace.intents.find(intent => intent.type === 'applyPastePlan');
    expect(pasteIntent).toMatchObject({
      type: 'applyPastePlan',
      plan: { ok: true, clipKind: 'event-run', document: target.doc }
    });
    await store.write('{"not":"the recorded clip"}');

    const replay = replayIntents(targetInitial, trace.intents);
    expect(replay.doc).toEqual(target.doc);
    expect(replay.selection).toEqual(target.selection);
    expect(replay.appliedOps.map(op => op.type)).toEqual(['pasteSelection']);
  });

  it('remaps a note landing to the pasted pitch rather than leaving the cursor on the old line', async () => {
    const store = new MemorySelectionClipboardStore();
    const source = new EditorSession(score('source', true));
    const target = new EditorSession(score('target'));
    await copySelectionToStore(source, store);
    expect((await pasteSelectionFromStore(target, store)).ok).toBe(true);

    expect(target.selectionLevel).toBe('note');
    expect(target.resolvedSelection.noteKeys).toHaveLength(1);
    expect(target.cursor.line).not.toBe(new EditorSession(score('target')).cursor.line);
  });

  it('lands structural clips as the new part and whole-score closures', async () => {
    const store = new MemorySelectionClipboardStore();
    const partSource = new EditorSession(score('source', true));
    const partTarget = new EditorSession(score('target'));
    relaxTo(partSource, 'partMeasure');
    expect(partSource.handleIntent({ type: 'closeSelection' })).toBe(true);
    relaxTo(partTarget, 'partMeasure');
    await copySelectionToStore(partSource, store);
    expect((await pasteSelectionFromStore(partTarget, store)).ok).toBe(true);
    expect(partTarget.doc.parts).toHaveLength(2);
    expect(partTarget.selection).toMatchObject({
      level: 'partMeasure',
      anchor: { partIndex: 1 },
      extent: { kind: 'closure', scope: 'part' }
    });
    expect(partTarget.resolvedSelection.members).toHaveLength(1);

    const scoreSource = new EditorSession(score('whole', true));
    const scoreTarget = new EditorSession(emptyScore());
    relaxTo(scoreSource, 'score');
    relaxTo(scoreTarget, 'score');
    await copySelectionToStore(scoreSource, store);
    expect((await pasteSelectionFromStore(scoreTarget, store)).ok).toBe(true);
    expect(scoreTarget.selection).toMatchObject({
      level: 'score',
      extent: { kind: 'closure', scope: 'score' }
    });
    expect(scoreTarget.resolvedSelection.members).toHaveLength(1);
  });

  it('refuses an empty app clipboard without entering history', async () => {
    const session = new EditorSession(score('target'));
    const result = await pasteSelectionFromStore(session, new MemorySelectionClipboardStore());
    expect(result).toEqual({
      ok: false,
      code: 'empty-clipboard',
      message: 'There is no copied selection to paste.'
    });
    expect(session.appliedOps).toEqual([]);
  });
});
