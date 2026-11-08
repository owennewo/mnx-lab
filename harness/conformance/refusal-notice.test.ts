// A refusal has to say something — roadmap/rejected/studio-editor-touch.md's
// sibling finding, met on the owner's own piece on 2026-09-20.
//
// A piece held open in a second tab is read-only, and read-only still allows
// NAVIGATION: the cursor moved to exactly where it was clicked, and then a
// typed fret vanished with no explanation anywhere but a chip beside the title.
// The mount made that worse than it had to be — it returned before the session
// saw the intent, so the refusal never reached the host's `onRefused` at all.
//
// The rule and its words live together in `edit/` precisely so this test can
// pin both. The one silence is deliberate and is the interesting half.
import { describe, it, expect } from 'vitest';
import { refusalNotice } from '../../src/edit/clipboardFeedback.ts';
import type { EditorIntent } from '../../src/edit/intents.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { EditorSession } from '../../src/edit/session.ts';
import { EDIT_LAYER, resolveIntent } from '../../src/edit/keymap.ts';

const FRET: EditorIntent = { type: 'enterFret', fret: 2 };
const NEXT: EditorIntent = { type: 'nextPosition' };
const POINTER: EditorIntent = {
  type: 'goToPointer',
  measureIndex: 2, partIndex: 0, staffIndex: 1,
  line: 3, projection: 'tab', fraction: 0.5
};

describe('refusalNotice', () => {
  it('explains a read-only piece, and says how to fix it', () => {
    const notice = refusalNotice(FRET, 'read-only');
    expect(notice).not.toBeNull();
    expect(notice!.ok).toBe(false);
    expect(notice!.message).toMatch(/another tab/i);
    expect(notice!.message).toMatch(/read only/i);
  });

  it('explains an older version, and names both ways out', () => {
    const notice = refusalNotice(FRET, 'suspended');
    expect(notice!.message).toMatch(/older version/i);
    expect(notice!.message).toMatch(/current/i);
  });

  it('says why a note cannot go inside another note or rest', () => {
    const notice = refusalNotice(FRET, 'inside-event');
    expect(notice!.ok).toBe(false);
    expect(notice!.message).toMatch(/inside another note or rest/i);
    expect(notice!.message).toMatch(/where one begins/i);
  });

  it('speaks for an edit the session itself declined', () => {
    expect(refusalNotice(FRET, 'unavailable')).not.toBeNull();
  });

  // The deliberate silence: walking out of the score is an edge, not a
  // refusal, and a notice on every press of the last bar would be noise.
  it('stays quiet when navigation simply ran out of score', () => {
    expect(refusalNotice(NEXT, 'unavailable')).toBeNull();
    expect(refusalNotice(POINTER, 'unavailable')).toBeNull();
  });

  // ...but a navigation intent refused because the piece cannot be touched at
  // all is still worth saying, since the reader asked for something the
  // document could have given.
  it('still explains navigation blocked by the document being elsewhere', () => {
    expect(refusalNotice(NEXT, 'suspended')).not.toBeNull();
  });
});

// The owner, 2026-11-08: two events selected, T pressed, and the only answer
// was "That can't be done here" — nothing said T ties ONE note. A refusal now
// says what the key does and what it needs, against what is selected; and a
// tuplet that does not fit says what the selection adds up to.
describe('a refusal says why', () => {
  const TIE: EditorIntent = { type: 'toggleTie' };
  const TRIPLET: EditorIntent = { type: 'wrapInContainer', spec: { type: 'tuplet', inner: { multiple: 3 }, outer: { multiple: 2 } } };

  it('names the key, what it does, the rung it works at, and what is selected', () => {
    const message = refusalNotice(TIE, 'unavailable', { level: 'event', members: 2 })!.message;
    expect(message).toMatch(/^T — tie to the same pitch in the next event/);
    expect(message).toMatch(/it works on a note/);
    expect(message).toMatch(/2 events are selected/);
  });

  it('at a rung where the key does work, says there was nothing to act on', () => {
    expect(refusalNotice(TIE, 'unavailable', { level: 'note', members: 1 })!.message).toMatch(/^T — tie .*: nothing here it can do that to\.$/);
  });

  it('a tuplet that does not fit says what the selection adds up to', () => {
    const message = refusalNotice(TRIPLET, 'wrap-misfit', { level: 'event', members: 3, selectedBeats: '1 3/4 beats' })!.message;
    expect(message).toMatch(/^3:2 needs notes that split into 3 equal note values/);
    expect(message).toMatch(/adds up to 1 3\/4 beats/);
  });

  it('without a context, or for an intent no key carries, it still speaks', () => {
    expect(refusalNotice(TIE, 'unavailable')!.message).toBe('That can’t be done here.');
    expect(refusalNotice({ type: 'setEventDuration', base: 'quarter' }, 'unavailable', { level: 'note', members: 1 })!.message)
      .toBe('That can’t be done here.');
  });
});

describe('Shift+T and the session’s misfit', () => {
  const run = (bases: ('quarter' | 'eighth')[]): MnxStructure => ({
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [{ id: 'p', measures: [{ sequences: [{ content: bases.map(base => ({ duration: { base }, notes: [{ pitch: { step: 'A', octave: 3 } }] })) }] }] }]
  } as MnxStructure);
  const TRIPLET = resolveIntent({ code: 'KeyT', shift: true }, [EDIT_LAYER])!;

  it('Shift+T is a 3:2 over the selected run', () => {
    expect(TRIPLET).toEqual({ type: 'toggleTriplet' });
    const session = new EditorSession(run(['quarter', 'quarter', 'quarter', 'quarter', 'eighth']));
    session.handleIntent({ type: 'goToLevel', level: 'event' });
    for (let i = 0; i < 3; i++) session.handleIntent({ type: 'nextPosition' });
    session.handleIntent({ type: 'extendSelection', direction: 'next' });
    expect(session.handleIntent(TRIPLET)).toBe(true);
    expect(session.doc.parts![0]!.measures![0]!.sequences![0]!.content[3]).toMatchObject({ type: 'tuplet', inner: { duration: { base: 'eighth' } } });
  });

  // The owner, 2026-11-08: a triplet selected, Shift+T, and it said "nothing
  // here it can do that to" — T toggles the tie, so Shift+T toggles the triplet.
  it('inside a triplet, Shift+T takes it away — from one of its notes, or the whole group', () => {
    const doc = (): MnxStructure => ({
      mnx: { version: 1 },
      global: { measures: [{ time: { count: 4, unit: 4 } }] },
      parts: [{ id: 'p', measures: [{ sequences: [{ content: [
        { duration: { base: 'quarter' }, notes: [{ pitch: { step: 'A', octave: 3 } }] },
        { type: 'tuplet', inner: { duration: { base: 'eighth' }, multiple: 3 }, outer: { duration: { base: 'eighth' }, multiple: 2 },
          content: [0, 1, 2].map(() => ({ duration: { base: 'eighth' }, notes: [{ pitch: { step: 'C', octave: 4 } }] })) },
        { duration: { base: 'half' }, notes: [{ pitch: { step: 'A', octave: 3 } }] }
      ] }] }] }]
    } as MnxStructure);
    const content = (s: EditorSession) => s.doc.parts![0]!.measures![0]!.sequences![0]!.content;
    // One note of it, at the note rung.
    const one = new EditorSession(doc());
    one.handleIntent({ type: 'nextPosition' });
    expect(one.handleIntent(TRIPLET)).toBe(true);
    expect(content(one).some(item => (item as { type?: string }).type === 'tuplet')).toBe(false);
    expect(content(one)).toHaveLength(5);
    // The whole group, at the event rung; undo puts it back exactly.
    const all = new EditorSession(doc());
    const before = JSON.stringify(all.doc);
    all.handleIntent({ type: 'goToLevel', level: 'event' });
    all.handleIntent({ type: 'nextPosition' });
    all.handleIntent({ type: 'extendSelection', direction: 'next' });
    all.handleIntent({ type: 'extendSelection', direction: 'next' });
    expect(all.handleIntent(TRIPLET)).toBe(true);
    expect(content(all)).toHaveLength(5);
    expect(all.handleIntent({ type: 'undo' })).toBe(true);
    expect(JSON.stringify(all.doc)).toBe(before);
  });

  it('a run that does not split refuses as wrap-misfit, measured in beats', () => {
    const session = new EditorSession(run(['quarter', 'quarter', 'eighth', 'eighth']));
    session.handleIntent({ type: 'goToLevel', level: 'event' });
    session.handleIntent({ type: 'nextPosition' });
    session.handleIntent({ type: 'extendSelection', direction: 'next' });
    session.handleIntent({ type: 'extendSelection', direction: 'next' });
    expect(session.handleIntent(TRIPLET)).toBe(false);
    expect(session.lastRefusal).toBe('wrap-misfit');
    expect(session.lastRefusalBeats).toBe('2 beats');
    // The next intent forgets it.
    session.handleIntent({ type: 'prevPosition' });
    expect(session.lastRefusal).toBeNull();
    expect(session.lastRefusalBeats).toBeNull();
  });
});
