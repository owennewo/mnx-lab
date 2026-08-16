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

/** The same document with a second part — the staves the climb walks. */
function makeTwoPartDoc(): MnxStructure {
  const doc = makeDoc();
  doc.parts.push({
    id: 'p2',
    measures: [
      { sequences: [{ content: [{ duration: { base: 'whole' }, notes: [note('n4', 'C', 3, 5)] }] }] },
      { sequences: [{ content: [{ duration: { base: 'whole' }, rest: {} }] }] }
    ],
    _x: { mnxLab: { strings: [...STANDARD_GUITAR_STRINGS] } }
  });
  return doc;
}

function makeTwoPartContainerDoc(): MnxStructure {
  const doc = makeTwoPartDoc();
  for (const part of doc.parts) {
    const sequence = part.measures![0].sequences[0];
    sequence.content[0] = {
      type: 'tuplet',
      inner: { multiple: 1, duration: { base: 'quarter' } },
      outer: { multiple: 1, duration: { base: 'quarter' } },
      content: [sequence.content[0] as never]
    };
  }
  return doc;
}

describe('keymap docs — the guard mirrors', () => {
  it('the Ctrl climb: documented per rung, and the session mirrors it', () => {
    // The climb's vertical, rung by rung (selection-ladder navigation map):
    // the voice at note level, the staves from event and voice-measure, the
    // system from part-measure. That last one is the MOUNT's — documented
    // because the reader gets it, refused by the session because the paint is
    // not visible from a DOM-free layer. Nothing wider has a vertical unit.
    const doc = KEY_DOCS.find(d => d.keys === 'Ctrl+↑/↓')!;
    expect(Object.keys(doc.meaning)).toEqual([
      'note', 'event', 'container', 'voiceMeasure', 'partMeasure'
    ]);

    const session = new EditorSession(makeTwoPartDoc());
    expect(session.selectionLevel).toBe('note');
    expect(session.handleIntent({ type: 'jumpDown' })).toBe(true); // two voices
    expect(session.cursor.voiceIndex).toBe(1);

    session.handleIntent({ type: 'relaxSelection' }); // → event
    expect(session.selectionLevel).toBe('event');
    expect(session.handleIntent({ type: 'jumpDown' })).toBe(true); // the second part
    expect(session.cursor.partIndex).toBe(1);
    expect(session.cursor.measureIndex).toBe(0); // the bar travels; the voice does not

    const container = new EditorSession(makeTwoPartContainerDoc());
    container.handleIntent({ type: 'relaxSelection' });
    container.handleIntent({ type: 'relaxSelection' });
    expect(container.selectionLevel).toBe('container');
    expect(container.handleIntent({ type: 'jumpDown' })).toBe(true);
    expect(container.cursor.partIndex).toBe(1);

    while (session.selectionLevel !== 'partMeasure') {
      session.handleIntent({ type: 'relaxSelection' });
    }
    expect(session.handleIntent({ type: 'jumpDown' })).toBe(false); // the mount's
    expect(session.handleIntent({ type: 'jumpUp' })).toBe(false);
  });

  it('bare ↑/↓: every rung but section, and exactly two belong to the mount', () => {
    // The table says what the READER gets, so measure and score are in it —
    // the neighbouring system and the next score. Both are resolved by the
    // mount and reach the session as `goToMeasure` or not at all, so the
    // session refuses them here. Naming the pair is the point of the test: a
    // THIRD rung quietly going inert would otherwise read as documented.
    const doc = KEY_DOCS.find(d => d.keys === '↑/↓')!;
    expect(Object.keys(doc.meaning)).toEqual([
      'note',
      'event',
      'container',
      'voiceMeasure',
      'partMeasure',
      'measure',
      'score'
    ]);

    // A session per rung: the voice step STOPS at the outermost voice, so a
    // shared session would arrive at the next rung already pressed against it.
    const handles = (level: string): boolean => {
      const session = new EditorSession(
        level === 'container' ? makeTwoPartContainerDoc() : makeTwoPartDoc()
      );
      while (session.selectionLevel !== level) session.handleIntent({ type: 'relaxSelection' });
      return session.handleIntent({ type: 'lineDown' });
    };
    expect(handles('event')).toBe(true);
    expect(handles('container')).toBe(true);
    expect(handles('voiceMeasure')).toBe(true);
    expect(handles('partMeasure')).toBe(true);
    expect(handles('measure')).toBe(false); // the mount's
    expect(handles('score')).toBe(false); // the mount's
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
