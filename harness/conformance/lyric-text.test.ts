// The lyric text surface's format engine (one-surface item 6, phase 2):
// the walk, the serializer, the parser and the diff — and the applyLyricPlan
// intent that lands the diff as one batch.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { EditorSession } from '../../src/edit/session.ts';
import {
  lyricEventWalk,
  parseLyricText,
  planLyricEdits,
  serializeLyricText
} from '../../src/edit/lyricText.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';

/** Three bars exercising every walk rule: rests skip, tuplet content is sung,
 *  grace content is not, a tie continuation is one syllable's tail. */
function makeSongDoc(): MnxStructure {
  const q = { base: 'quarter' as const };
  const note = (id: string, step: string, octave: number) => ({ id, pitch: { step, octave } });
  return {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }, {}, {}] },
    parts: [{
      measures: [
        { sequences: [{ content: [
          { duration: q, notes: [note('n1', 'C', 4)] },
          { duration: q, notes: [note('n2', 'D', 4)] },
          { duration: q, rest: {} },
          { duration: q, notes: [note('n3', 'E', 4)] }
        ] }] },
        { sequences: [{ content: [
          { type: 'tuplet', inner: { duration: q, multiple: 3 }, outer: { duration: q, multiple: 2 }, content: [
            { duration: q, notes: [note('n4', 'F', 4)] },
            { duration: q, notes: [note('n5', 'G', 4)] },
            { duration: q, notes: [note('n6', 'A', 4)] }
          ] },
          { type: 'grace', content: [{ duration: q, notes: [note('g1', 'B', 4)] }] },
          { duration: { base: 'half' }, notes: [{ ...note('n7', 'C', 5), ties: [{ target: 'n8' }] }] }
        ] }] },
        { sequences: [{ content: [
          { duration: q, notes: [note('n8', 'C', 5)] },
          { duration: q, notes: [note('n9', 'D', 5)] },
          { duration: { base: 'half' }, rest: {} }
        ] }] }
      ]
    }]
  } as MnxStructure;
}

const verseLabelsDoc = (): MnxStructure =>
  JSON.parse(readFileSync(new URL('../../scenarios/lab/50-lyrics/01-verse-labels/document.mnx.json', import.meta.url), 'utf8'));

describe('the lyric event walk', () => {
  it('sings voice 1: rests, grace content and tie continuations skipped, tuplet content kept', () => {
    const walk = lyricEventWalk(makeSongDoc(), 0);
    expect(walk.map(entry => entry.noteKey)).toEqual(['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n9']);
    expect(walk.map(entry => entry.measureIndex)).toEqual([0, 0, 0, 1, 1, 1, 1, 2]);
  });
});

describe('parse', () => {
  const doc = makeSongDoc();

  it('fills events in order: hyphens split, suffix underscores extend, ~ elides', () => {
    const parsed = parseLyricText(doc, 0, 'Twin-kle lit-tle star_ you~are');
    expect(parsed.diagnostics).toEqual([]);
    const [line] = parsed.lines;
    expect(line!.lineId).toBe('1');
    expect(line!.minted).toBe(true);
    expect([...line!.syllables.entries()]).toEqual([
      [0, { text: 'Twin', type: 'start' }],
      [1, { text: 'kle', type: 'end' }],
      [2, { text: 'lit', type: 'start' }],
      [3, { text: 'tle', type: 'end' }],
      [4, { text: 'star' }],
      // index 5 held by the extender; 6 gets the elision
      [6, { text: 'you are' }]
    ]);
  });

  it('hyphen runs hold events mid-word; standalone underscores skip', () => {
    const parsed = parseLyricText(doc, 0, '__ fant--as-tic');
    expect(parsed.diagnostics).toEqual([]);
    expect([...parsed.lines[0]!.syllables.entries()]).toEqual([
      [2, { text: 'fant', type: 'start' }],
      // index 3 held by the double hyphen
      [4, { text: 'as', type: 'middle' }],
      [5, { text: 'tic', type: 'end' }]
    ]);
  });

  it('bar checks resync, numbered checks jump, and both complain honestly', () => {
    const jumped = parseLyricText(doc, 0, '3| last');
    expect(jumped.diagnostics).toEqual([]);
    expect([...jumped.lines[0]!.syllables.keys()]).toEqual([7]);

    const spilled = parseLyricText(doc, 0, 'a b c d 2|');
    expect(spilled.diagnostics).toMatchObject([{ textLine: 0, bar: 2, message: expect.stringContaining('too many syllables') }]);

    const beyond = parseLyricText(doc, 0, '9| x');
    expect(beyond.diagnostics[0]).toMatchObject({ message: expect.stringContaining('beyond the music') });

    const overflow = parseLyricText(doc, 0, 'a b c d e f g h i j');
    expect(overflow.diagnostics).toMatchObject([{ message: expect.stringContaining('more syllables than sung notes') }]);

    const midWord = parseLyricText(doc, 0, 'sleep-');
    expect(midWord.diagnostics).toMatchObject([{ message: expect.stringContaining('mid-word') }]);
  });

  it('headers pick language groups and ordinals; lines mint the numeric convention', () => {
    const parsed = parseLyricText(doc, 0, 'first verse here\nnl: eerste vers hier\n2: second verse here');
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.lines.map(line => ({ id: line.lineId, minted: line.minted, lang: line.lang ?? null }))).toEqual([
      { id: '1', minted: true, lang: null },
      { id: '2', minted: true, lang: 'nl' },
      { id: '3', minted: true, lang: null } // primary ordinal 2, id '2' taken by the nl line
    ]);
  });

  it('maps tokens to walk entries for the cross-highlight', () => {
    const parsed = parseLyricText(doc, 0, 'one two\nla la');
    const spans = parsed.tokens.map(span => ({ entry: span.entryIndex, text: 'one two\nla la'.slice(span.from, span.to) }));
    expect(spans).toEqual([
      { entry: 0, text: 'one' },
      { entry: 1, text: 'two' },
      { entry: 0, text: 'la' },
      { entry: 1, text: 'la' }
    ]);
  });
});

describe('serialize', () => {
  it('projects the verse-labels scenario: stacking order, labels stay in metadata', () => {
    expect(serializeLyricText(verseLabelsDoc(), 0)).toBe('Shine bright\nMorn-ing');
  });

  it('round-trips: parse(serialize(doc)) diffs to nothing', () => {
    for (const doc of [verseLabelsDoc(), appliedSongDoc()]) {
      const text = serializeLyricText(doc, 0);
      const parsed = parseLyricText(doc, 0, text);
      expect(parsed.diagnostics).toEqual([]);
      expect(planLyricEdits(doc, 0, parsed)).toEqual([]);
    }
  });

  it('spells bar checks between texted bars and holds melisma with underscores', () => {
    const doc = appliedSongDoc();
    expect(serializeLyricText(doc, 0)).toBe('Twin-kle lit- | -tle star_ you~are');
  });
});

/** makeSongDoc with a verse applied through the one funnel. */
function appliedSongDoc(): MnxStructure {
  const session = new EditorSession(makeSongDoc());
  const parsed = parseLyricText(session.doc, 0, 'Twin-kle lit-tle star_ you~are');
  expect(parsed.diagnostics).toEqual([]);
  const edits = planLyricEdits(session.doc, 0, parsed);
  expect(session.handleIntent({ type: 'applyLyricPlan', edits })).toBe(true);
  return session.doc;
}

describe('the plan and its application', () => {
  it('diffs buffer vs document: sets, removals, and minted-line metadata', () => {
    const doc = appliedSongDoc();
    // Retype with one change and one language line; drop nothing.
    const parsed = parseLyricText(doc, 0, 'Twin-kle lit-tle moon_ you~are\nnl: la');
    const edits = planLyricEdits(doc, 0, parsed);
    expect(edits).toEqual([
      { op: 'setLyricLine', line: '2', lang: 'nl' },
      { op: 'setSyllable', noteKey: 'n1', line: '2', text: 'la' },
      { op: 'setSyllable', noteKey: 'n5', line: '1', text: 'moon' }
    ]);
  });

  it('an emptied buffer clears the part\'s lyrics; apply is one undo step', () => {
    const session = new EditorSession(makeSongDoc());
    const first = planLyricEdits(session.doc, 0, parseLyricText(session.doc, 0, 'one two three'));
    expect(session.handleIntent({ type: 'applyLyricPlan', edits: first })).toBe(true);
    expect(session.doc.parts![0]!.measures![0]!.sequences![0]!.content![0]).toMatchObject({
      lyrics: { lines: { '1': { text: 'one' } } }
    });
    const clear = planLyricEdits(session.doc, 0, parseLyricText(session.doc, 0, ''));
    expect(clear).toEqual([
      { op: 'removeSyllable', noteKey: 'n1', line: '1' },
      { op: 'removeSyllable', noteKey: 'n2', line: '1' },
      { op: 'removeSyllable', noteKey: 'n3', line: '1' }
    ]);
    expect(session.handleIntent({ type: 'applyLyricPlan', edits: clear })).toBe(true);
    expect(session.doc.parts![0]!.measures![0]!.sequences![0]!.content![0]).not.toHaveProperty('lyrics');
    // One undo gesture restores the whole clear.
    expect(session.handleIntent({ type: 'undo' })).toBe(true);
    expect(session.doc.parts![0]!.measures![0]!.sequences![0]!.content![0]).toMatchObject({
      lyrics: { lines: { '1': { text: 'one' } } }
    });
    // An empty plan is a refusal, not a silent success.
    expect(session.handleIntent({ type: 'applyLyricPlan', edits: [] })).toBe(false);
  });
});
