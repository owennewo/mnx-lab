// The lyric text surface's format engine (one-surface item 6, phase 2):
// the walk, the serializer, the parser and the diff — and the applyLyricPlan
// intent that lands the diff as one batch.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { EditorSession } from '../../src/edit/session.ts';
import {
  lyricEventWalk,
  lyricPassWarnings,
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

  it('bar lines step a bar at a time, a run of empty bars several, and both complain honestly', () => {
    const stepped = parseLyricText(doc, 0, '| | last');
    expect(stepped.diagnostics).toEqual([]);
    expect([...stepped.lines[0]!.syllables.keys()]).toEqual([7]);
    // `×2` (or `x2`, as typed) is two bars without words: the bar line after it leads into bar 3.
    for (const run of ['×2 | last', 'x2 | last'])
      expect([...parseLyricText(doc, 0, run).lines[0]!.syllables.keys()]).toEqual([7]);

    const spilled = parseLyricText(doc, 0, 'a b c d |');
    expect(spilled.diagnostics).toMatchObject([{ textLine: 0, bar: 2, played: 2, message: expect.stringContaining('too many syllables') }]);

    const beyond = parseLyricText(doc, 0, '| | | x');
    expect(beyond.diagnostics[0]).toMatchObject({ message: expect.stringContaining('past the end of the music') });

    const overflow = parseLyricText(doc, 0, 'a b c d e f g h i j');
    expect(overflow.diagnostics).toMatchObject([{ message: expect.stringContaining('more syllables than sung notes') }]);

    // Bar numbers are gone: the text runs from the first bar played.
    expect(parseLyricText(doc, 0, 'one\n3| last').diagnostics).toMatchObject([{ textLine: 1, message: expect.stringContaining('no bar numbers') }]);
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
    const parsed = parseLyricText(doc, 0, 'one two\n2:\nla la');
    const spans = parsed.tokens.map(span => ({ entry: span.entryIndex, text: 'one two\n2:\nla la'.slice(span.from, span.to) }));
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
    // A verse no pass reaches (a hymn's) is a block of its own, from the first bar played again.
    expect(serializeLyricText(verseLabelsDoc(), 0)).toBe('Shine bright\n2:\nMorn-ing');
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

describe('the pass bound (phase 3)', () => {
  it('stays silent when the document declares no repeat structure', () => {
    const doc = makeSongDoc();
    const parsed = parseLyricText(doc, 0, 'one two\nthree four\nfive six');
    expect(lyricPassWarnings(doc, 0, parsed)).toEqual([]);
  });

  it('flags a verse whose pass the strain never sounds; enough passes stay silent', () => {
    const doc = makeSongDoc();
    doc.global!.measures![0]!.repeatStart = {};
    doc.global!.measures![2]!.repeatEnd = {};
    const okay = parseLyricText(doc, 0, 'one two\nthree four');
    expect(lyricPassWarnings(doc, 0, okay)).toEqual([]);
    const spilled = parseLyricText(doc, 0, 'one two\n3:\nfive six');
    expect(lyricPassWarnings(doc, 0, spilled)).toMatchObject([
      { textLine: 1, bar: 1, severity: 'warning', message: expect.stringContaining('verses 1, 2') }
    ]);
  });

  it('translations are exempt by construction — ordinals run per language', () => {
    const doc = makeSongDoc();
    doc.global!.measures![0]!.repeatStart = {};
    doc.global!.measures![2]!.repeatEnd = {};
    const parsed = parseLyricText(doc, 0, 'one two\nnl: een twee');
    expect(lyricPassWarnings(doc, 0, parsed)).toEqual([]);
  });

  it('names volta text on the wrong ending', () => {
    const doc = makeSongDoc();
    doc.global!.measures![0]!.repeatStart = {};
    doc.global!.measures![1]!.ending = { numbers: [1], duration: 1 };
    doc.global!.measures![1]!.repeatEnd = {};
    doc.global!.measures![2]!.ending = { numbers: [2], duration: 1 };
    // Verse 1 text on the second ending's bar (1.1, 2.1, 1.2, then 3.1): it only sings verse 2.
    const parsed = parseLyricText(doc, 0, '1:\n| | | last');
    expect(lyricPassWarnings(doc, 0, parsed)).toMatchObject([
      { textLine: 0, bar: 3, severity: 'warning', message: expect.stringContaining('verse 2') }
    ]);
  });
});

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

  it('amending replaces the last lyric step, so a panel visit is one undo step', () => {
    const session = new EditorSession(makeSongDoc());
    const base = session.doc;
    const first = (doc: MnxStructure) => doc.parts![0]!.measures![0]!.sequences![0]!.content![0];
    // The panel plans every commit against the document its visit opened on.
    const plan = (text: string) => planLyricEdits(base, 0, parseLyricText(base, 0, text));
    expect(session.handleIntent({ type: 'applyLyricPlan', edits: plan('one two') })).toBe(true);
    expect(session.handleIntent({ type: 'applyLyricPlan', edits: plan('won two'), amend: true })).toBe(true);
    expect(first(session.doc)).toMatchObject({ lyrics: { lines: { '1': { text: 'won' } } } });
    expect(session.handleIntent({ type: 'undo' })).toBe(true);
    expect(session.doc).toBe(base);
    // Redo brings back the amended step, not the one it replaced.
    expect(session.handleIntent({ type: 'redo' })).toBe(true);
    expect(first(session.doc)).toMatchObject({ lyrics: { lines: { '1': { text: 'won' } } } });
    // Typed back to where the visit began: the step goes, and nothing is left to undo.
    expect(session.handleIntent({ type: 'applyLyricPlan', edits: plan(''), amend: true })).toBe(true);
    expect(session.doc).toBe(base);
    expect(session.handleIntent({ type: 'undo' })).toBe(false);
  });

  it('amending over a step that is not a lyric plan adds a step of its own', () => {
    const session = new EditorSession(makeSongDoc());
    const edits = planLyricEdits(session.doc, 0, parseLyricText(session.doc, 0, 'one'));
    expect(session.handleIntent({ type: 'applyLyricPlan', edits, amend: true })).toBe(true);
    expect(session.handleIntent({ type: 'undo' })).toBe(true);
    expect(session.handleIntent({ type: 'undo' })).toBe(false);
  });
});


describe('performance lyric text', () => {
  it('opening and applying a sparse lyric does not move words across empty bars', () => {
    const doc = makeSongDoc();
    const walk = lyricEventWalk(doc, 0);
    walk[0]!.event.lyrics = { lines: { '1': { text: 'first' } } };
    walk[7]!.event.lyrics = { lines: { '1': { text: 'last' } } };
    const parsed = parseLyricText(doc, 0, serializeLyricText(doc, 0));
    expect(parsed.diagnostics).toEqual([]);
    expect(planLyricEdits(doc, 0, parsed)).toEqual([]);
  });
});

function bars(count: number, notes = 2): MnxStructure {
  return {
    mnx: { version: 1 }, global: { measures: Array.from({ length: count }, () => ({})) },
    parts: [{ measures: Array.from({ length: count }, (_, bar) => ({ sequences: [{ content:
      Array.from({ length: notes }, (_, n) => ({ duration: { base: 'quarter' },
        notes: [{ id: `b${bar}n${n}`, pitch: { step: 'C', octave: 4 } }] }))
    }] })) }]
  } as MnxStructure;
}
function put(doc: MnxStructure, bar: number, row: string, text: string, note = 0) {
  const entry = lyricEventWalk(doc, 0).filter(e => e.measureIndex === bar - 1)[note]!;
  ((entry.event.lyrics ??= {}).lines ??= {})[row] = { text };
}
function unchanged(doc: MnxStructure) {
  const text = serializeLyricText(doc, 0);
  const parsed = parseLyricText(doc, 0, text);
  expect(parsed.diagnostics).toEqual([]);
  expect(planLyricEdits(doc, 0, parsed)).toEqual([]);
  return text;
}

describe('performance order and canonical wrapping', () => {
  it('finishes all four visits to bars 9–12 before bar 13', () => {
    const doc = bars(14);
    doc.global.measures[8]!.repeatStart = {};
    doc.global.measures[11]!.repeatEnd = { times: 4 };
    put(doc, 9, '1', 'first'); put(doc, 12, '1', 'end');
    put(doc, 9, '2', 'second'); put(doc, 10, '3', 'third'); put(doc, 9, '4', 'fourth');
    put(doc, 13, '1', 'after');
    // No bar numbers: a lead-in run stands alone, and bars nobody sings close the line before them.
    const text = unchanged(doc);
    expect(text).toBe('×8 |\nfirst | ×2 |\nend |\nsecond | ×4 |\nthird | ×2 |\nfourth | ×3 |\nafter');
    // The margin is told where each line starts (9.1, 12.1, 9.2, 10.3, 9.4, 13.1) and which cross silence.
    expect(parseLyricText(doc, 0, text).starts!.map(s => [s.ordinal, s.sung, s.gap])).toEqual([
      [0, false, true], [8, true, true], [11, true, false], [12, true, true], [17, true, true], [20, true, true], [24, true, false]
    ]);
  });

  it('a line that opens on a bar line starts in the bar it leads into, and a header starts a block', () => {
    const doc = bars(3);
    const parsed = parseLyricText(doc, 0, 'a\n| b\n2:\n| c');
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.starts!.map(s => [s.textLine, s.ordinal, s.block])).toEqual([[0, 0, 0], [1, 1, 0], [3, 1, 1]]);
    expect(parsed.headers).toEqual([2]);
  });

  it('a bar added inside a run nudges every word after it along; taken out again, they come back', () => {
    const doc = bars(8);
    for (let bar = 1; bar <= 6; bar++) put(doc, bar, '1', `w${bar}`);
    const text = unchanged(doc);
    expect(text).toBe('w1 | w2 | w3 | w4 |\nw5 | w6');
    const nudged = parseLyricText(doc, 0, text.replace('w2', '| w2'));
    expect(nudged.diagnostics).toEqual([]);
    // w2…w6 each move one bar on — across the line break, into bar 7.
    expect(nudged.lines[0]!.syllables.size).toBe(6);
    const session = new EditorSession(doc);
    session.handleIntent({ type: 'applyLyricPlan', edits: planLyricEdits(doc, 0, nudged) });
    expect(unchanged(session.doc)).toBe('w1 | ×1 |\nw2 | w3 | w4 | w5 |\nw6');
    const back = parseLyricText(session.doc, 0, 'w1 | w2 | w3 | w4 |\nw5 | w6');
    session.handleIntent({ type: 'applyLyricPlan', edits: planLyricEdits(session.doc, 0, back) });
    expect(unchanged(session.doc)).toBe(text);
  });

  it('bars nobody sings are one run, however many, closing the line before them', () => {
    const doc = bars(12);
    put(doc, 1, '1', 'a'); put(doc, 6, '1', 'b'); put(doc, 12, '1', 'c');
    expect(unchanged(doc)).toBe('a | ×4 |\nb | ×5 |\nc');
  });

  it('bare pipes advance across empty bars and an all-rest bar', () => {
    const doc = bars(4);
    doc.parts[0]!.measures[1]!.sequences[0]!.content = [{ duration: { base: 'whole' }, rest: {} }];
    for (const text of ['one | | three | four', 'one | ×1 | three | four']) {
      const parsed = parseLyricText(doc, 0, text);
      expect(parsed.diagnostics).toEqual([]);
      expect(parsed.lines[0]!.syllables.size).toBe(3);
      expect(planLyricEdits(doc, 0, parsed).flatMap(e => 'noteKey' in e ? [e.noteKey] : [])).toEqual(['b0n0', 'b2n0', 'b3n0']);
    }
  });

  it('wraps at four bars and at 80 characters, preserving cross-line syllables', () => {
    const doc = bars(6);
    for (let bar = 1; bar <= 6; bar++) put(doc, bar, '1', `word${bar}`);
    expect(unchanged(doc)).toBe('word1 | word2 | word3 | word4 |\nword5 | word6');
    put(doc, 1, '1', 'y'.repeat(75));
    expect(unchanged(doc).split('\n').slice(0, 2)).toEqual([`${'y'.repeat(75)} |`, 'word2 | word3 | word4 | word5 |']);
    const walk = lyricEventWalk(doc, 0);
    walk[6]!.event.lyrics!.lines!['1'] = { text: 'begin', type: 'start' };
    walk[8]!.event.lyrics!.lines!['1'] = { text: 'end', type: 'end' };
    unchanged(doc);
  });

  it('a D.S. return sings the next verse: unwritten, it is unsung, and typing there writes a new row', () => {
    const doc = bars(3);
    doc.global.measures[0]!.repeatStart = {};
    doc.global.measures[0]!.segno = { location: { fraction: [0, 1] } };
    doc.global.measures[1]!.repeatEnd = {};
    doc.global.measures[1]!.fine = { location: { fraction: [1, 1] } };
    doc.global.measures[2]!.jump = { type: 'dsalfine', location: { fraction: [1, 1] } };
    put(doc, 1, '1', 'first'); put(doc, 1, '2', 'second');
    // The return is verse 3, and nothing is written there — so it prints nothing, rather than verse 1 again.
    expect(unchanged(doc)).toBe('first | ×1 |\nsecond');
    const parsed = parseLyricText(doc, 0, 'changed | ×1 |\nsecond');
    expect(planLyricEdits(doc, 0, parsed)).toMatchObject([{ line: '1', text: 'changed' }]);
    // Words typed at the return (1.3, after 2.2 and 3.1) are its own: a third row, and verse 1 is untouched.
    const third = parseLyricText(doc, 0, 'first | ×1 |\nsecond | ×2 |\nthird');
    // A new row with words needs no declaration: its words keep it (a Guitar Pro save could not).
    expect(third.lines.filter(line => line.minted).map(line => line.ordinal)).toEqual([3]);
    expect(third.newRows).toBeUndefined();
    expect(planLyricEdits(doc, 0, third).filter(edit => edit.op === 'setSyllable')).toMatchObject([{ text: 'third' }]);
    // A block naming the same stored row explicitly still has to agree with the pass that sings it.
    const conflict = parseLyricText(doc, 0, '×2 | different\n2:\nchanged');
    expect(conflict.diagnostics.map(d => d.message)).toEqual([
      '1.2 sings “different” and 1.1 sings “changed”, but both are verse 2 of the same written notes, which hold one set of words — make them match'
    ]);
    expect(planLyricEdits(doc, 0, conflict)).toEqual([]);
  });

  it('a verse two blocks write differently at one place is named once, on the later block', () => {
    const doc = bars(3);
    const parsed = parseLyricText(doc, 0, 'a b\n1:\nc');
    expect(parsed.diagnostics).toEqual([{ textLine: 1,
      message: 'verse 1 at 1.1 is written twice, differently — in the main text and under “1:”; keep one' }]);
    expect(planLyricEdits(doc, 0, parsed)).toEqual([]);
    // The same word at the same place is no disagreement.
    expect(parseLyricText(doc, 0, 'a b\n1:\na').diagnostics).toEqual([]);
  });

  it('first visit to a second ending maps to verse two, not verse one', () => {
    const doc = bars(3);
    doc.global.measures[0]!.repeatStart = {};
    doc.global.measures[1]!.ending = { numbers: [1], duration: 1 };
    doc.global.measures[1]!.repeatEnd = {};
    doc.global.measures[2]!.ending = { numbers: [2], duration: 1 };
    put(doc, 1, '1', 'first'); put(doc, 3, '2', 'ending');
    expect(unchanged(doc)).toBe('first | ×2 |\nending');
  });

  it('accepts phrase newlines and maps caret offsets back to the original buffer', () => {
    const doc = bars(2);
    const text = 'one\ntwo |\nthree';
    const parsed = parseLyricText(doc, 0, text);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.tokens.map(t => [text.slice(t.from, t.to), t.entryIndex])).toEqual([['one', 0], ['two', 1], ['three', 2]]);
  });

  it('mints separate verse rows when pasting into a repeated score without lyrics', () => {
    const doc = bars(2);
    doc.global.measures[0]!.repeatStart = {};
    doc.global.measures[1]!.repeatEnd = {};
    const parsed = parseLyricText(doc, 0, 'first | ×1 |\nsecond');
    expect(parsed.lines.map(l => l.lineId)).toEqual(['1', '2']);
  });

  it('rejects bar numbers, runs past the end, runs among words and overflow without offering destructive edits', () => {
    const doc = bars(2);
    for (const text of ['1.1| word', 'word 2| more', 'word | | x', '×3 | word', 'a ×1 | b', 'a b c d e', 'a b| c']) {
      const parsed = parseLyricText(doc, 0, text);
      expect(parsed.diagnostics.length, text).toBeGreaterThan(0);
      expect(planLyricEdits(doc, 0, parsed)).toEqual([]);
    }
    expect(parseLyricText(doc, 0, 'a b c | d').diagnostics[0]!.message).toContain('too many syllables');
  });

  it('preserves translations and explicit hymn rows', () => {
    const doc = verseLabelsDoc();
    doc.global.lyrics!.lineMetadata!['verse2']!.lang = 'nl';
    expect(unchanged(doc)).toBe('Shine bright\nnl:\nMorn-ing');
  });
});

it('keeps only events inside a partial-bar navigation visit', () => {
  const doc = bars(2, 4);
  doc.global.measures[0]!.segno = { location: { fraction: [1, 2] } };
  doc.global.measures[1]!.jump = { type: 'segno', location: { fraction: [1, 1] } };
  put(doc, 1, '1', 'before'); put(doc, 1, '1', 'after', 2);
  // The partial D.S. visit is verse 2, unwritten — it does not sing verse 1's 'after' again.
  expect(unchanged(doc)).toBe('before_ after');
});

it('wraps a hyphenated word across canonical lines without treating the wrap as a word end', () => {
  const doc = bars(5);
  for (let bar = 1; bar <= 5; bar++) put(doc, bar, '1', 'word');
  const walk = lyricEventWalk(doc, 0);
  walk[6]!.event.lyrics!.lines!['1'] = { text: 'be', type: 'start' };
  walk[8]!.event.lyrics!.lines!['1'] = { text: 'yond', type: 'end' };
  expect(unchanged(doc)).toBe('word | word | word | be- |\n-yond');
});

it('rejects numbered and malformed bar markers', () => {
  for (const text of ['one 2| two', 'one 2.x| two']) {
    expect(parseLyricText(bars(2), 0, text).diagnostics.length).toBeGreaterThan(0);
  }
});

it('retains the ordinal of a newly entered sparse verse and arbitrary existing row ids', () => {
  for (const existing of [false, true]) {
    const doc = bars(2);
    doc.global.measures[0]!.repeatStart = {};
    doc.global.measures[1]!.repeatEnd = {};
    if (existing) put(doc, 1, 'verse-first', 'old');
    const session = new EditorSession(doc);
    // Verse 2 at bar 1's second visit (1.1, 2.1, then 1.2), named by its header.
    const parsed = parseLyricText(doc, 0, `${existing ? 'old\n' : ''}2:\n×2 | new`);
    expect(parsed.diagnostics).toEqual([]);
    session.handleIntent({ type: 'applyLyricPlan', edits: planLyricEdits(doc, 0, parsed) });
    expect(unchanged(session.doc)).toBe(existing ? 'old | ×1 |\nnew' : '×2 |\nnew');
  }
});

it('escapes header-shaped and run-shaped lyric text in canonical output', () => {
  for (const word of ['nl:', 'x4']) {
    const doc = bars(1);
    put(doc, 1, '1', word);
    expect(unchanged(doc)).toBe(`\\${word}`);
  }
});

it('accepts a bar line into a real final bar containing only rests', () => {
  const doc = bars(2);
  doc.parts[0]!.measures[1]!.sequences[0]!.content = [{ duration: { base: 'whole' }, rest: {} }];
  expect(parseLyricText(doc, 0, 'one |').diagnostics).toEqual([]);
});

it('places each word on its performed visit and onset, where the caret moves the cursor', () => {
  const doc = bars(2);
  doc.global.measures[0]!.repeatStart = {};
  doc.global.measures[0]!.repeatEnd = {};
  // Bar 1 twice: 1.1 is ordinal 0, 1.2 ordinal 1; bar 2 is ordinal 2.
  const parsed = parseLyricText(doc, 0, 'one two |\n_ three | four');
  expect(parsed.diagnostics).toEqual([]);
  expect(parsed.tokens.map(t => [t.ordinal, t.onset])).toEqual([[0, [0, 1]], [0, [1, 4]], [1, [1, 4]], [2, [0, 1]]]);
});
