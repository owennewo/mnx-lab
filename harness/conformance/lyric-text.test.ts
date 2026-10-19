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
    expect(serializeLyricText(verseLabelsDoc(), 0)).toBe('1.1| Shine bright\n1.1| 2: Morn-ing');
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
    expect(serializeLyricText(doc, 0)).toBe('1.1| Twin-kle lit- | -tle star_ you~are');
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
    const spilled = parseLyricText(doc, 0, 'one two\nthree four\nfive six');
    expect(lyricPassWarnings(doc, 0, spilled)).toMatchObject([
      { textLine: 2, bar: 1, severity: 'warning', message: expect.stringContaining('verses 1, 2') }
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
    // Verse 1 text on the second ending's bar: it only sings verse 2.
    const parsed = parseLyricText(doc, 0, '3| last');
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

describe('performance anchors and canonical wrapping', () => {
  it('finishes all four visits to bars 9–12 before bar 13', () => {
    const doc = bars(14);
    doc.global.measures[8]!.repeatStart = {};
    doc.global.measures[11]!.repeatEnd = { times: 4 };
    put(doc, 9, '1', 'first'); put(doc, 12, '1', 'end');
    put(doc, 9, '2', 'second'); put(doc, 10, '3', 'third'); put(doc, 9, '4', 'fourth');
    put(doc, 13, '1', 'after');
    expect(unchanged(doc)).toBe('9.1| first | | | end\n9.2| second\n10.3| third\n9.4| fourth\n13.1| after');
  });

  it('bare pipes advance across empty bars and an all-rest bar', () => {
    const doc = bars(4);
    doc.parts[0]!.measures[1]!.sequences[0]!.content = [{ duration: { base: 'whole' }, rest: {} }];
    const parsed = parseLyricText(doc, 0, '1.1| one | | three | four');
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.lines[0]!.syllables.size).toBe(3);
    expect(planLyricEdits(doc, 0, parsed).flatMap(e => 'noteKey' in e ? [e.noteKey] : [])).toEqual(['b0n0', 'b2n0', 'b3n0']);
  });

  it('wraps at four bars and at 80 characters, preserving cross-line syllables', () => {
    const doc = bars(6);
    for (let bar = 1; bar <= 6; bar++) put(doc, bar, '1', `word${bar}`);
    expect(unchanged(doc)).toBe('1.1| word1 | word2 | word3 | word4\n5.1| word5 | word6');
    put(doc, 1, '1', 'x'.repeat(70));
    expect(unchanged(doc).split('\n')[1]).toMatch(/^2\.1\|/);
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
    expect(unchanged(doc)).toBe('1.1| first\n1.2| second');
    const parsed = parseLyricText(doc, 0, '1.1| changed\n1.2| second');
    expect(planLyricEdits(doc, 0, parsed)).toMatchObject([{ line: '1', text: 'changed' }]);
    // Words typed at the return are its own: a third row, and verse 1 is untouched.
    const third = parseLyricText(doc, 0, '1.1| first\n1.2| second\n1.3| third');
    expect(third.newRows).toHaveLength(1);
    expect(planLyricEdits(doc, 0, third).filter(edit => edit.op === 'setSyllable')).toMatchObject([{ text: 'third' }]);
    // Two anchors naming the same stored row explicitly still have to agree.
    const conflict = parseLyricText(doc, 0, '1.1| 2: changed\n1.2| different');
    expect(conflict.diagnostics.map(d => d.message)).toEqual([
      '1.1 sings “changed” and 1.2 sings “different”, but both are verse 2 of the same written notes, which hold one set of words — make them match'
    ]);
    expect(planLyricEdits(doc, 0, conflict)).toEqual([]);
  });

  it('a passage that runs on into the next anchor is named once, on its own line, with the words that ran on', () => {
    const doc = bars(3);
    // Three syllables from 1.1 fill bar 1 (two notes) and run one into bar 2, which 2.1 also writes.
    const parsed = parseLyricText(doc, 0, '1.1| a b c\n2.1| d e');
    expect(parsed.diagnostics).toEqual([{ textLine: 0, bar: 2,
      message: '1.1 runs 1 syllable on into 2.1 (“c”), which has words of its own — move them into the 2.1 line, or delete the 2.1| anchor to let the text flow on' }]);
    expect(planLyricEdits(doc, 0, parsed)).toEqual([]);
    // The same word at the same place is no disagreement.
    expect(parseLyricText(doc, 0, '1.1| a b d\n2.1| d e').diagnostics).toEqual([]);
    // Deleting the anchor lets the words flow on.
    expect(parseLyricText(doc, 0, '1.1| a b c d e').diagnostics).toEqual([]);
    // Anchoring one place twice says so.
    expect(parseLyricText(doc, 0, '2.1| x\n2.1| y').diagnostics.map(d => d.message)).toEqual([
      '2.1 is anchored twice — keep one 2.1| and put its words together'
    ]);
  });

  it('first visit to a second ending maps to verse two, not verse one', () => {
    const doc = bars(3);
    doc.global.measures[0]!.repeatStart = {};
    doc.global.measures[1]!.ending = { numbers: [1], duration: 1 };
    doc.global.measures[1]!.repeatEnd = {};
    doc.global.measures[2]!.ending = { numbers: [2], duration: 1 };
    put(doc, 1, '1', 'first'); put(doc, 3, '2', 'ending');
    expect(unchanged(doc)).toContain('3.1| ending');
  });

  it('accepts phrase newlines and maps caret offsets back to the original buffer', () => {
    const doc = bars(2);
    const text = '1.1| one\ntwo |\nthree';
    const parsed = parseLyricText(doc, 0, text);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.tokens.map(t => [text.slice(t.from, t.to), t.entryIndex])).toEqual([['one', 0], ['two', 1], ['three', 2]]);
  });

  it('mints separate verse rows when pasting into a repeated score without lyrics', () => {
    const doc = bars(2);
    doc.global.measures[0]!.repeatStart = {};
    doc.global.measures[1]!.repeatEnd = {};
    const parsed = parseLyricText(doc, 0, '1.1| first\n1.2| second');
    expect(parsed.lines.map(l => l.lineId)).toEqual(['1', '2']);
  });

  it('rejects nonexistent occurrences and overflow without offering destructive edits', () => {
    const doc = bars(2);
    for (const text of ['1.0| word', '1.2| word', '0.1| word', '3.1| word', '1.1| a b c 2.1| d']) {
      const parsed = parseLyricText(doc, 0, text);
      expect(parsed.diagnostics.length).toBeGreaterThan(0);
      expect(planLyricEdits(doc, 0, parsed)).toEqual([]);
    }
    expect(parseLyricText(doc, 0, '1.1| a b c | d').diagnostics[0]!.message).toContain('too many syllables');
  });

  it('preserves translations and explicit hymn rows', () => {
    const doc = verseLabelsDoc();
    doc.global.lyrics!.lineMetadata!['verse2']!.lang = 'nl';
    expect(unchanged(doc)).toBe('1.1| Shine bright\n1.1| nl: Morn-ing');
  });
});

it('keeps only events inside a partial-bar navigation visit', () => {
  const doc = bars(2, 4);
  doc.global.measures[0]!.segno = { location: { fraction: [1, 2] } };
  doc.global.measures[1]!.jump = { type: 'segno', location: { fraction: [1, 1] } };
  put(doc, 1, '1', 'before'); put(doc, 1, '1', 'after', 2);
  // The partial D.S. visit is verse 2, unwritten — it does not sing verse 1's 'after' again.
  expect(unchanged(doc)).toBe('1.1| before_ after');
});

it('wraps a hyphenated word across canonical lines without treating the wrap as a word end', () => {
  const doc = bars(5);
  for (let bar = 1; bar <= 5; bar++) put(doc, bar, '1', 'word');
  const walk = lyricEventWalk(doc, 0);
  walk[6]!.event.lyrics!.lines!['1'] = { text: 'be', type: 'start' };
  walk[8]!.event.lyrics!.lines!['1'] = { text: 'yond', type: 'end' };
  expect(unchanged(doc)).toBe('1.1| word | word | word | be-\n5.1| -yond');
});

it('rejects ambiguous or malformed numbered markers in anchored text', () => {
  for (const text of ['1.1| one 2| two', '1.1| one 2.x| two']) {
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
    const parsed = parseLyricText(doc, 0, `${existing ? '1.1| old\n' : ''}1.2| 2: new`);
    expect(parsed.diagnostics).toEqual([]);
    session.handleIntent({ type: 'applyLyricPlan', edits: planLyricEdits(doc, 0, parsed) });
    expect(unchanged(session.doc)).toContain('1.2| new');
  }
});

it('escapes header-shaped lyric text in canonical output', () => {
  const doc = bars(1);
  put(doc, 1, '1', 'nl:');
  expect(unchanged(doc)).toBe('1.1| \\nl:');
});

it('accepts an anchor on a real final bar containing only rests', () => {
  const doc = bars(2);
  doc.parts[0]!.measures[1]!.sequences[0]!.content = [{ duration: { base: 'whole' }, rest: {} }];
  expect(parseLyricText(doc, 0, '2.1|').diagnostics).toEqual([]);
});

it('places each anchored word on its performed visit and onset, where the caret moves the cursor', () => {
  const doc = bars(2);
  doc.global.measures[0]!.repeatStart = {};
  doc.global.measures[0]!.repeatEnd = {};
  // Bar 1 twice: 1.1 is ordinal 0, 1.2 ordinal 1; bar 2 is ordinal 2.
  const parsed = parseLyricText(doc, 0, '1.1| one two\n1.2| _ three | four');
  expect(parsed.diagnostics).toEqual([]);
  expect(parsed.tokens.map(t => [t.ordinal, t.onset])).toEqual([[0, [0, 1]], [0, [1, 4]], [1, [1, 4]], [2, [0, 1]]]);
});
