// The rung inspector's data layer (roadmap/inprogress/workbench-rung-inspector.md).
//
// The component is neutral; everything that can rot lives in the mapping —
// crumbs that drift from the HUD's rows, a pill whose removal the session
// refuses, a kind the typeahead cannot name, a value that does not round-trip
// through the grammar. These are joins, in the tray's tradition.
import { describe, it, expect } from 'vitest';
import { EditorSession } from '../../src/edit/session.ts';
import { applyOp, MEASURE_ATTRIBUTE_FIELDS, readMeasureAttributes, type MeasureAttribute, type MeasureAttributeKind } from '../../src/edit/ops.ts';
import { SURFACE_INTENTS } from '../../src/edit/keymapDocs.ts';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { STANDARD_GUITAR_STRINGS } from '../../src/model/mnx.ts';
import {
  attributeText,
  BAR_WORDS,
  crumbSiblings,
  keyAt,
  keyWord,
  measurePills,
  parseInspectorLine,
  pillsFor,
  techniqueText,
  timeAt,
  wordsFor
} from '../../src/edit/inspector.ts';
import { readPositionedAttributes, readTechniques, type PositionedAttribute, type TechniqueChoice } from '../../src/edit/ops.ts';
import type { SelectionLevel } from '../../src/edit/selection.ts';
import { parseRhythm } from '../../src/edit/setupGrammar.ts';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

function makeDoc(): MnxStructure {
  return {
    mnx: { version: 1 },
    global: {
      measures: [
        { time: { count: 4, unit: 4 }, key: { fifths: -2 }, section: { label: 'Verse 1' } },
        { barline: { type: 'double' }, tempos: [{ bpm: 120, value: { base: 'quarter' } }] },
        { section: { label: 'Chorus' }, repeatEnd: { times: 3 } }
      ]
    },
    parts: [
      {
        id: 'p1',
        name: 'Guitar',
        measures: [0, 1, 2].map(() => ({
          sequences: [{ content: [{ duration: { base: 'whole' }, rest: {} }] }]
        })),
        _x: { mnxLab: { strings: [...STANDARD_GUITAR_STRINGS] } }
      },
      {
        id: 'p2',
        name: 'Bass',
        measures: [0, 1, 2].map(() => ({
          sequences: [{ content: [{ duration: { base: 'whole' }, rest: {} }] }]
        }))
      }
    ]
  };
}

/** One of every kind, for the round trips. */
const ONE_OF_EACH: MeasureAttribute[] = [
  { kind: 'barline', type: 'final' },
  { kind: 'repeatStart' },
  { kind: 'repeatEnd', times: 3 },
  { kind: 'ending', numbers: [1, 2] },
  { kind: 'segno' },
  { kind: 'fine' },
  { kind: 'jump', type: 'dsalfine' },
  { kind: 'tempo', bpm: 120, base: 'quarter' },
  { kind: 'rehearsal', label: 'A' },
  { kind: 'section', label: 'Verse 1' }
];

const atBar = (measureIndex: number) => {
  const session = new EditorSession(makeDoc());
  session.handleIntent({ type: 'goToLevel', level: 'measure' });
  session.handleIntent({ type: 'goToMeasure', measureIndex });
  return session;
};

describe('the crumbs’ siblings', () => {
  it('the bar and part crumbs offer their siblings, and each sibling’s intent lands', () => {
    const session = atBar(1);
    const bar = crumbSiblings(session.doc, 'bar', session.cursor)!;
    expect(bar.map(s => s.label)).toEqual(['1 · 4/4', '2 · 4/4', '3 · 4/4']);
    expect(bar.map(s => s.current)).toEqual([false, true, false]);
    expect(session.handleIntent(bar[2]!.intent)).toBe(true);
    expect(session.cursor.measureIndex).toBe(2);

    const part = crumbSiblings(session.doc, 'part', session.cursor)!;
    expect(part.map(s => s.label)).toEqual(['Guitar', 'Bass']);
    expect(session.handleIntent(part[1]!.intent)).toBe(true);
    expect(session.cursor.partIndex).toBe(1);
  });

  it('sections list every section with its range; the narrow rungs offer none', () => {
    const session = atBar(0);
    const section = crumbSiblings(session.doc, 'section', session.cursor)!;
    expect(section.map(s => `${s.label} ${s.detail}`)).toEqual(['Verse 1 m1–2', 'Chorus m3–3']);
    for (const key of ['voice', 'container', 'event', 'note', 'document'])
      expect(crumbSiblings(session.doc, key, session.cursor)).toBeNull();
  });
});

describe('the pills at the bar rung', () => {
  it('read what the bar declares, and the two signatures it carries', () => {
    const doc = makeDoc();
    expect(measurePills(doc, 1).map(p => `${p.word}: ${p.value} [${p.pillClass}]`)).toEqual([
      'time: 4/4 [inherited]',
      'key: Bb [inherited]',
      'barline: double [floor]',
      'tempo: quarter=120 [annotation]'
    ]);
    expect(measurePills(doc, 0).map(p => `${p.word}: ${p.value} [${p.pillClass}]`)).toEqual([
      'time: 4/4 [floor]',
      'key: Bb [annotation]',
      'barline: regular [floor]',
      'section: Verse 1 [annotation]'
    ]);
  });

  it('keys are unique within the rung, tempos included', () => {
    const doc = makeDoc();
    doc.global.measures[1]!.tempos!.push({ bpm: 80, value: { base: 'half' } });
    const keys = measurePills(doc, 1).map(p => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('tempo#0');
    expect(keys).toContain('tempo#1');
  });

  it('every removable pill’s intent is one the session accepts — and it removes the pill', () => {
    for (const measureIndex of [0, 1, 2]) {
      const session = atBar(measureIndex);
      for (const pill of measurePills(session.doc, measureIndex)) {
        if (!pill.remove) {
          // Nothing to strip: an inherited reading, or a barline already at
          // its floor.
          expect(pill.pillClass === 'inherited' || (pill.key === 'barline' && pill.value === 'regular')).toBe(true);
          continue;
        }
        const before = session.doc;
        expect(session.handleIntent(pill.remove), `${pill.key} at m${measureIndex + 1}`).toBe(true);
        const after = measurePills(session.doc, measureIndex).find(p => p.key === pill.key);
        // A floor pill survives at its floor; an annotation is gone.
        if (pill.pillClass === 'floor') expect(after?.value).not.toBe(pill.value);
        else expect(after).toBeUndefined();
        session.handleIntent({ type: 'undo' });
        expect(session.doc).toEqual(before);
      }
    }
  });

  it('an inherited reading has nothing to remove', () => {
    const doc = makeDoc();
    const key = measurePills(doc, 2).find(p => p.key === 'key')!;
    expect(key.pillClass).toBe('inherited');
    expect(key.remove).toBeNull();
    expect(keyAt(doc, 2)).toEqual({ fifths: -2, declaredAt: 0 });
    expect(timeAt(doc, 2)).toEqual({ count: 4, unit: 4 });
  });
});

describe('the typeahead is derived from the union', () => {
  it('names every attribute kind, plus the two signatures', () => {
    const kinds = Object.keys(MEASURE_ATTRIBUTE_FIELDS) as MeasureAttributeKind[];
    expect(BAR_WORDS.length).toBe(kinds.length + 2);
    for (const attribute of ONE_OF_EACH) {
      const text = attributeText(attribute);
      expect(BAR_WORDS.some(w => text.startsWith(w.word)), text).toBe(true);
    }
  });

  it('every kind’s typed form parses back to the same attribute', () => {
    for (const attribute of ONE_OF_EACH) {
      const parsed = parseInspectorLine('measure', null, attributeText(attribute));
      expect(parsed, attribute.kind).toEqual({
        intent: { type: 'setMeasureAttribute', attribute }
      });
    }
  });

  it('an amend prepends the pill’s word — one op, an upsert', () => {
    expect(parseInspectorLine('measure', 'tempo', 'half=80')).toEqual({
      intent: { type: 'setMeasureAttribute', attribute: { kind: 'tempo', bpm: 80, base: 'half' } }
    });
    expect(parseInspectorLine('measure', 'time', '3/4')).toEqual({
      intent: { type: 'setTimeSignature', count: 3, unit: 4 }
    });
    expect(parseInspectorLine('measure', 'key', keyWord(3))).toEqual({
      intent: { type: 'setKeySignature', fifths: 3 }
    });
    expect(parseInspectorLine('measure', 'key', 'inherit')).toEqual({ intent: { type: 'removeKeySignature' } });
  });

  it('says why a line was refused rather than doing nothing', () => {
    expect(parseInspectorLine('measure', null, 'banana')).toMatchObject({ error: expect.stringContaining('not a bar attribute') });
    expect(parseInspectorLine('measure', 'time', 'x')).toMatchObject({ error: expect.stringContaining('time signature') });
    expect(parseInspectorLine('measure', null, 'full-measure rest')).toMatchObject({ error: expect.stringContaining('Shift+B') });
  });
});

describe('readMeasureAttributes is the reverse of the op', () => {
  it('set then read yields the attribute, for every kind', () => {
    for (const attribute of ONE_OF_EACH) {
      const doc = applyOp(makeDoc(), { type: 'setMeasureAttribute', measureIndex: 2, attribute });
      const read = readMeasureAttributes(doc.global.measures[2]);
      expect(read, attribute.kind).toContainEqual(attribute);
    }
  });
});

describe('the surface is honest about what it emits', () => {
  it('every intent the inspector lists is one the session handles', () => {
    const source = fs.readFileSync(path.join(ROOT, 'src/edit/session.ts'), 'utf8');
    const handled = new Set([...source.matchAll(/case '([a-zA-Z]+)'/g)].map(m => m[1]));
    for (const type of SURFACE_INTENTS.rungInspector ?? []) {
      expect(handled.has(type), type).toBe(true);
    }
  });
});


// ── stages 4–5: the other rungs, and ranges ──────────────────────────────────

/** A part with notes to stand on: two quarters and a rest per bar. */
function makeNoteDoc(): MnxStructure {
  const bar = (ids: [string, string]) => ({
    sequences: [
      {
        content: [
          { duration: { base: 'quarter' as const }, notes: [{ id: ids[0], pitch: { step: 'E' as const, octave: 4 }, _x: { mnxLab: { string: 1 } } }] },
          { duration: { base: 'quarter' as const }, notes: [{ id: ids[1], pitch: { step: 'G' as const, octave: 4 }, _x: { mnxLab: { string: 1 } } }] },
          { duration: { base: 'half' as const }, rest: {} }
        ]
      }
    ]
  });
  return {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }, {}] },
    parts: [
      {
        id: 'p1',
        name: 'Guitar',
        measures: [bar(['a', 'b']), bar(['c', 'd'])],
        _x: { mnxLab: { strings: [...STANDARD_GUITAR_STRINGS], capo: 2 } }
      }
    ]
  };
}

const at = (level: SelectionLevel, doc = makeNoteDoc()) => {
  const session = new EditorSession(doc);
  session.handleIntent({ type: 'goToLevel', level });
  return session;
};
/** What the page does after every inspector edit: a point edit re-anchors the
 *  selection at the note, and the inspector puts the rung back. */
const edit = (session: EditorSession, intent: Parameters<EditorSession['handleIntent']>[0]) => {
  const level = session.selectionLevel;
  const ok = session.handleIntent(intent);
  if (ok && session.selectionLevel !== level) session.handleIntent({ type: 'goToLevel', level });
  return ok;
};
const scope = (session: EditorSession) => ({
  doc: session.doc,
  level: session.selectionLevel,
  members: session.resolvedSelection.members
});
const pillText = (session: EditorSession) =>
  pillsFor(scope(session)).map(p => `${p.word}: ${p.value}${p.partial ? ' ~' : ''} [${p.pillClass}]`);

describe('event pills', () => {
  it('read the duration as a floor, and each marking, positioned attribute and syllable as removable', () => {
    const session = at('event');
    expect(pillText(session)).toEqual(['duration: quarter [floor]']);
    for (const text of ['staccato', 'breath comma', 'dynamic mf', 'text below cantabile', '8va 2', 'lyric sleep-']) {
      const parsed = parseInspectorLine('event', null, text);
      expect(parsed, text).toHaveProperty('intent');
      expect(edit(session, (parsed as { intent: never }).intent), text).toBe(true);
    }
    expect(pillText(session)).toEqual([
      'duration: quarter [floor]',
      'staccato:  [annotation]',
      'breath: comma [annotation]',
      'dynamic: mf [annotation]',
      'text: below cantabile [annotation]',
      '8va: 2 [annotation]',
      'lyric: sleep- [annotation]'
    ]);
    // Every removal lands, and the pill goes.
    for (const pill of pillsFor(scope(session))) {
      if (!pill.remove) continue;
      expect(edit(session, pill.remove), pill.key).toBe(true);
      expect(pillsFor(scope(session)).find(p => p.key === pill.key)).toBeUndefined();
    }
  });

  it('duration is amended by value — one op, refused when unchanged', () => {
    const session = at('event');
    expect(parseInspectorLine('event', 'duration', 'quarter')).toEqual({ intent: { type: 'setEventDuration', base: 'quarter' } });
    expect(session.handleIntent({ type: 'setEventDuration', base: 'quarter' })).toBe(false);
    expect(edit(session, { type: 'setEventDuration', base: 'eighth', dots: 1 })).toBe(true);
    expect(pillText(session)[0]).toBe('duration: eighth. [floor]');
    expect(parseInspectorLine('event', 'duration', 'banana')).toHaveProperty('error');
  });

  it('readPositionedAttributes is the reverse of setPositioned, for every kind', () => {
    const cases: PositionedAttribute[] = [
      { kind: 'dynamic', value: 'mf' },
      { kind: 'dynamic', dynamicType: 'gradual', wedgeType: 'increasing' },
      { kind: 'direction', text: 'cantabile', orient: 'below' },
      { kind: 'ottava', value: 1, bars: 2 }
    ];
    for (const attribute of cases) {
      const session = at('event');
      expect(session.handleIntent({ type: 'setPositioned', attribute })).toBe(true);
      const read = readPositionedAttributes(session.doc, { partIndex: 0, staffIndex: 1, measureIndex: 0 }, [0, 1]);
      expect(read.map(r => r.attribute), attribute.kind).toContainEqual(attribute);
    }
  });
});

describe('note pills', () => {
  it('read string, accidental, fingering and techniques, then the event’s own', () => {
    const session = at('note');
    expect(pillText(session)).toEqual(['pitch: E4 [floor]', 'string: 1 [annotation]']);
    for (const text of ['accidental parens', 'finger left 3', 'vibrato', 'bend pre 1 2 release', 'staccato']) {
      const parsed = parseInspectorLine('note', null, text);
      expect(parsed, text).toHaveProperty('intent');
      expect(edit(session, (parsed as { intent: never }).intent), text).toBe(true);
    }
    expect(pillText(session)).toEqual([
      'pitch: E4 [floor]',
      'string: 1 [annotation]',
      'accidental: parens [annotation]',
      'fingering: left 3 [annotation]',
      'bend: pre 1 2 release [annotation]',
      'vibrato:  [annotation]',
      'staccato:  [annotation]'
    ]);
  });

  it('a bend round-trips through the widened op — pre, peak, release — and amends without toggling', () => {
    const cases: TechniqueChoice[] = [
      { kind: 'bend', semitones: 2 },
      { kind: 'bend', semitones: 2, release: true },
      { kind: 'bend', semitones: 2, pre: 1 },
      { kind: 'bend', semitones: 3, release: true, pre: 1 },
      { kind: 'bend', semitones: 2, pre: 1, release: true }
    ];
    for (const technique of cases) {
      const session = at('note');
      expect(session.handleIntent({ type: 'setTechnique', technique })).toBe(true);
      const note = session.doc.parts![0]!.measures![0]!.sequences![0]!.content[0]!.notes![0]!;
      expect(readTechniques(note), techniqueText(technique)).toEqual([technique]);
      // Typed form parses back to the same thing.
      expect(parseInspectorLine('note', 'bend', techniqueText(technique))).toEqual({ intent: { type: 'setTechnique', technique } });
      // Amend: a second set replaces rather than removing.
      expect(session.handleIntent({ type: 'setTechnique', technique: { kind: 'bend', semitones: 4 } })).toBe(true);
      expect(readTechniques(session.doc.parts![0]!.measures![0]!.sequences![0]!.content[0]!.notes![0]!)).toEqual([{ kind: 'bend', semitones: 4 }]);
    }
    // The pre-widening forms still write byte-identical curves.
    const plain = at('note');
    plain.handleIntent({ type: 'toggleTechnique', kind: 'bend' });
    expect(plain.doc.parts![0]!.measures![0]!.sequences![0]!.content[0]!.notes![0]!._x!.mnxLab!.tab!.technique!.bend).toEqual({
      points: [{ position: 0, alter: 0 }, { position: 1, alter: 2 }]
    });
    const released = at('note');
    released.handleIntent({ type: 'toggleTechnique', kind: 'bend', release: true });
    expect(released.doc.parts![0]!.measures![0]!.sequences![0]!.content[0]!.notes![0]!._x!.mnxLab!.tab!.technique!.bend).toEqual({
      points: [{ position: 0, alter: 2 }, { position: 0.5, alter: 2 }, { position: 1, alter: 0 }]
    });
  });
});

describe('identity pills', () => {
  it('the pitch is a floor pill amended by transpose, spelt back by the same grammar', () => {
    const session = at('note');
    const pitch = { step: 'E', octave: 4 };
    expect(parseInspectorLine('note', 'pitch', 'G4', { pitch })).toEqual({ intent: { type: 'transpose', semitones: 3 } });
    expect(parseInspectorLine('note', 'pitch', 'Eb4', { pitch })).toEqual({ intent: { type: 'transpose', semitones: -1 } });
    expect(parseInspectorLine('note', 'pitch', 'E4', { pitch })).toHaveProperty('error');
    expect(parseInspectorLine('note', 'pitch', 'H9', { pitch })).toHaveProperty('error');
    expect(edit(session, { type: 'transpose', semitones: 3 })).toBe(true);
    expect(pillText(session)[0]).toBe('pitch: G4 [floor]');
  });

  it('a section’s name is a floor pill: amend sets it, empty is refused', () => {
    const session = new EditorSession(makeDoc());
    session.handleIntent({ type: 'goToLevel', level: 'section' });
    expect(pillText(session)).toEqual(['name: Verse 1 [floor]', 'bars: 1–2 [inherited]']);
    expect(parseInspectorLine('section', 'name', '')).toHaveProperty('error');
    expect(parseInspectorLine('section', 'name', 'Intro')).toEqual({ intent: { type: 'setMeasureAttribute', attribute: { kind: 'section', label: 'Intro' } } });
    expect(wordsFor('section').map(w => w.word)).toEqual(['name']);
  });
});

describe('the wider rungs', () => {
  it('voice-bar: full-measure rest and measure repeat', () => {
    const session = at('voiceMeasure');
    expect(pillText(session)).toEqual([]);
    const parsed = parseInspectorLine('voiceMeasure', null, 'measure repeat 2');
    expect(parsed).toEqual({ intent: { type: 'setMeasureRepeat', number: 2 } });
    expect(edit(session, (parsed as { intent: never }).intent)).toBe(true);
    expect(pillText(session)).toEqual(['measure repeat: 2 [annotation]']);
    expect(parseInspectorLine('voiceMeasure', null, 'staccato')).toHaveProperty('error');
  });

  it('part-bar: clef and capo, strings as a reading', () => {
    const session = at('partMeasure');
    expect(pillText(session)).toEqual(['capo: 2 [annotation]', 'strings: 6 strings [inherited]']);
    const clef = parseInspectorLine('partMeasure', null, 'clef bass');
    expect(clef).toHaveProperty('intent');
    expect(edit(session, (clef as { intent: never }).intent)).toBe(true);
    expect(pillText(session)[0]).toBe('clef: bass [annotation]');
    expect(parseInspectorLine('partMeasure', 'capo', '5')).toEqual({ intent: { type: 'setPartDeclaration', declaration: { kind: 'capo', value: 5 } } });
  });

  it('container: read-only pills, no words', () => {
    // Three quarters fill "3 quarter in 2 quarter" exactly; a grace steals no
    // time, so it has no position of its own to stand on.
    const q = (id: string) => ({ duration: { base: 'quarter' as const }, notes: [{ id, pitch: { step: 'E' as const, octave: 4 } }] });
    const session = new EditorSession({
      mnx: { version: 1 },
      global: { measures: [{ time: { count: 4, unit: 4 } }] },
      parts: [{ id: 'p1', measures: [{ sequences: [{ content: [q('a'), q('b'), q('c'), { duration: { base: 'quarter' as const }, rest: {} }] }] }] }]
    });
    session.handleIntent({ type: 'setProjection', projection: 'notation' });
    const wrap = parseRhythm('3:2') as { wrap: never };
    expect(session.handleIntent({ type: 'wrapInContainer', spec: wrap.wrap })).toBe(true);
    expect(session.handleIntent({ type: 'goToLevel', level: 'container' })).toBe(true);
    const pills = pillsFor(scope(session));
    expect(pills.map(p => `${p.word}: ${p.value}`)).toEqual(['tuplet: 3:2 quarter']);
    expect(pills.every(p => p.pillClass === 'inherited' && p.remove === null)).toBe(true);
    expect(wordsFor('container')).toEqual([]);
    expect(parseInspectorLine('container', null, 'bracket yes')).toHaveProperty('error');
  });
});

describe('ranges', () => {
  it('a pill on some members is partial; on all, solid — and removal strips it from the ones that have it', () => {
    const session = at('event');
    edit(session, { type: 'setMarking', marking: 'staccato' });
    session.handleIntent({ type: 'extendSelection', direction: 'next' });
    expect(session.resolvedSelection.members.length).toBe(2);
    const pills = pillsFor(scope(session));
    expect(pills.find(p => p.key === 'marking:staccato')?.partial).toBe(true);
    expect(pills.find(p => p.key === 'duration')?.partial).toBeUndefined();
    session.handleIntent({ type: 'setMarking', marking: 'accent' });
    expect(pillsFor(scope(session)).find(p => p.key === 'marking:accent')?.partial).toBeUndefined();
    expect(session.handleIntent({ type: 'removeMarking', marking: 'staccato' })).toBe(true);
    expect(pillsFor(scope(session)).find(p => p.key === 'marking:staccato')).toBeUndefined();
  });

  it('bars: attributes set on one of two selected bars read half-tone', () => {
    const session = atBar(0);
    session.handleIntent({ type: 'extendSelection', direction: 'next' });
    expect(session.resolvedSelection.members.length).toBe(2);
    const pills = pillsFor(scope(session));
    expect(pills.find(p => p.key === 'section')?.partial).toBe(true);
    expect(pills.find(p => p.key === 'barline')?.partial).toBeUndefined();
  });
});
