// The keymap meaning table (roadmap/inprogress/core-keymap-cheatsheet.md):
// the joins that keep the cheatsheet honest — every binding documented,
// every documented stroke bound — and the guard mirrors: a rung ABSENT from
// a KeyDoc's meaning map must be a session no-op, or the cheatsheet lies.
import { describe, it, expect } from 'vitest';
import {
  allBindingStrokes,
  cheatsheet,
  KEY_DOCS,
  strokeKey
} from '../../src/edit/keymapDocs.ts';
import { EditorSession } from '../../src/edit/session.ts';
import type { MnxNote, MnxPitch, MnxStructure } from '../../src/model/mnx.ts';
import { STANDARD_GUITAR_STRINGS } from '../../src/model/mnx.ts';

const note = (id: string, step: MnxPitch['step'], octave: number, string: number): MnxNote => ({
  id,
  pitch: { step, octave },
  _x: { mnxLab: { string } }
});

/** One bar, two voices — enough for the voice jump and the ladder walk. */
function makeDoc(): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{}, {}] },
    parts: [
      {
        id: 'p1',
        measures: [
          {
            sequences: [
              {
                content: [
                  { duration: { base: 'quarter' }, notes: [note('n1', 'E', 4, 1)] },
                  { duration: { base: 'quarter' }, notes: [note('n2', 'G', 4, 1)] }
                ]
              },
              { content: [{ duration: { base: 'half' }, notes: [note('n3', 'G', 3, 3)] }] }
            ]
          },
          { sequences: [{ content: [{ duration: { base: 'whole' }, rest: {} }] }] }
        ],
        _x: { mnxLab: { strings: [...STANDARD_GUITAR_STRINGS] } }
      }
    ]
  };
}

describe('keymap docs — the joins', () => {
  it('documents every binding stroke (three layers + shell)', () => {
    const documented = new Set(KEY_DOCS.flatMap(d => d.strokes.map(strokeKey)));
    const undocumented = allBindingStrokes()
      .map(strokeKey)
      .filter(k => !documented.has(k));
    expect(undocumented).toEqual([]);
  });

  it('binds every documented stroke (no stale docs)', () => {
    const bound = new Set(allBindingStrokes().map(strokeKey));
    const stale = KEY_DOCS.flatMap(d => d.strokes.map(strokeKey)).filter(k => !bound.has(k));
    expect(stale).toEqual([]);
  });
});

describe('keymap docs — the guard mirrors', () => {
  it('voice jump: documented at note only, and the session refuses elsewhere', () => {
    const doc = KEY_DOCS.find(d => d.keys === 'Ctrl+↑/↓')!;
    expect(Object.keys(doc.meaning)).toEqual(['note']);

    const session = new EditorSession(makeDoc());
    expect(session.selectionLevel).toBe('note');
    expect(session.handleIntent({ type: 'jumpDown' })).toBe(true); // two voices

    session.handleIntent({ type: 'relaxSelection' }); // → event
    session.handleIntent({ type: 'relaxSelection' }); // → voiceMeasure
    expect(session.selectionLevel).not.toBe('note');
    expect(session.handleIntent({ type: 'jumpDown' })).toBe(false);
    expect(session.handleIntent({ type: 'jumpUp' })).toBe(false);
  });

  it('toggleNote: documented notation-only, and the tab projection refuses', () => {
    const doc = KEY_DOCS.find(d => d.strokes.some(s => s.code === 'Space'))!;
    expect(doc.requires).toBe('notationProjection');

    const session = new EditorSession(makeDoc()); // string mode ⇒ tab projection
    expect(session.projection).toBe('tab');
    expect(session.handleIntent({ type: 'toggleNote' })).toBe(false);
  });

  it('arrows at score: no documented meaning, and the cursor stays put', () => {
    const doc = KEY_DOCS.find(d => d.keys === '←/→')!;
    expect(doc.meaning.score).toBeUndefined();
    expect(doc.meaning.all).toBeUndefined();

    const session = new EditorSession(makeDoc());
    while (session.selectionLevel !== 'score') {
      session.handleIntent({ type: 'relaxSelection' });
    }
    const before = session.cursor;
    expect(session.handleIntent({ type: 'nextPosition' })).toBe(false);
    expect(session.cursor).toEqual(before);
  });
});

describe('the cheatsheet render', () => {
  it('is level-dependent: frets at note level in a tab pane, none at measure', () => {
    const atNote = cheatsheet('note', { tabPane: true, projection: 'tab' });
    const entry = atNote.find(g => g.label === 'Note entry');
    expect(entry?.rows.some(r => r.keys === '0–9')).toBe(true);

    const atMeasure = cheatsheet('measure', { tabPane: true, projection: 'tab' });
    expect(atMeasure.find(g => g.label === 'Note entry')).toBeUndefined();
    // The selection-scoped verbs survive widening.
    expect(
      atMeasure.find(g => g.label === 'Editing')?.rows.some(r => r.keys === 'Alt+↑/↓')
    ).toBe(true);
  });

  it('is context-dependent: no fret row without a tab pane, no Space in tab', () => {
    const notation = cheatsheet('note', { tabPane: false, projection: 'notation' });
    expect(notation.flatMap(g => g.rows).some(r => r.keys === '0–9')).toBe(false);
    expect(notation.flatMap(g => g.rows).some(r => r.keys === 'Space')).toBe(true);

    const tab = cheatsheet('note', { tabPane: true, projection: 'tab' });
    expect(tab.flatMap(g => g.rows).some(r => r.keys === 'Space')).toBe(false);
  });

  it('groups arrive in display order with no empty groups', () => {
    const groups = cheatsheet('score', { tabPane: false, projection: 'notation' });
    expect(groups.every(g => g.rows.length > 0)).toBe(true);
    expect(groups.map(g => g.label)).toContain('Workbench');
  });
});
