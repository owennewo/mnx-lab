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
import { findNoteAddress } from '../../src/model/noteWalk.ts';
import {
  attributeText,
  BAR_WORDS,
  crumbSiblings,
  fingerboardOf,
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
  { kind: 'segno', glyph: 'segnoSerpent2', at: [1, 2] },
  { kind: 'fine' },
  { kind: 'fine', at: 'end' },
  { kind: 'fermata' },
  { kind: 'fermata', symbol: 'square', duration: 'long', orient: 'below' },
  { kind: 'number', value: 12 },
  { kind: 'tempo', bpm: 96, base: 'quarter', at: [1, 2] },
  { kind: 'harmony', text: 'Am7' },
  { kind: 'harmony', text: 'D/F#', at: [1, 2] },
  { kind: 'jump', type: 'dsalfine' },
  { kind: 'jump', type: 'segno', at: [3, 4] },
  { kind: 'tempo', bpm: 120, base: 'quarter' },
  { kind: 'tempo', bpm: 60, base: 'quarter', dots: 1 },
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

  it('only bars and parts have siblings — sections are a bar attribute, not a rung', () => {
    const session = atBar(0);
    for (const key of ['voice', 'container', 'event', 'note', 'section', 'document'])
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
    // The popover's whole grammar reaches the ops through this line — the
    // retirement (one-surface campaign item 2) leans on these two forms.
    expect(parseInspectorLine('measure', 'time', 'common')).toEqual({
      intent: { type: 'setTimeSignature', count: 4, unit: 4, display: 'common' }
    });
    expect(parseInspectorLine('measure', 'time', 'inherit')).toEqual({ intent: { type: 'removeTimeSignature' } });
    expect(parseInspectorLine('measure', 'key', keyWord(3))).toEqual({
      intent: { type: 'setKeySignature', fifths: 3 }
    });
    expect(parseInspectorLine('measure', 'key', 'inherit')).toEqual({ intent: { type: 'removeKeySignature' } });
  });

  it('says why a line was refused rather than doing nothing', () => {
    expect(parseInspectorLine('measure', null, 'banana')).toMatchObject({ error: expect.stringContaining('not a bar attribute') });
    expect(parseInspectorLine('measure', 'time', 'x')).toMatchObject({ error: expect.stringContaining('time signature') });
    // The refusal is a signpost now, not a popover pointer (item 4 retired Shift+B).
    expect(parseInspectorLine('measure', null, 'full-measure rest')).toMatchObject({ error: expect.stringContaining('voice rung') });
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

describe('the tempos array is addressable by index (core-measure-attributes-gaps.md, bug 1)', () => {
  it('an add from the slot appends; an amend of tempo#N sets that entry; removing tempo#1 keeps tempo#0', () => {
    const session = atBar(1);
    // Bar 2 declares one tempo (quarter=120). Add a second from the slot.
    const add = parseInspectorLine('measure', null, 'tempo half=80', { tempoCount: 1 });
    expect(add).toEqual({ intent: { type: 'setMeasureAttribute', attribute: { kind: 'tempo', bpm: 80, base: 'half' }, index: 1 } });
    expect(session.handleIntent((add as { intent: never }).intent)).toBe(true);
    expect(measurePills(session.doc, 1).filter(p => p.word === 'tempo').map(p => `${p.key} ${p.value}`)).toEqual([
      'tempo#0 quarter=120',
      'tempo#1 half=80'
    ]);
    // Amend the second by its key.
    const amend = parseInspectorLine('measure', 'tempo', 'half=60', { key: 'tempo#1' });
    expect(amend).toEqual({ intent: { type: 'setMeasureAttribute', attribute: { kind: 'tempo', bpm: 60, base: 'half' }, index: 1 } });
    expect(session.handleIntent((amend as { intent: never }).intent)).toBe(true);
    expect(session.doc.global.measures[1]!.tempos!.map(t => t.bpm)).toEqual([120, 60]);
    // Remove the second: the first survives (this is the bug that was there).
    const second = measurePills(session.doc, 1).find(p => p.key === 'tempo#1')!;
    expect(second.remove).toEqual({ type: 'removeMeasureAttribute', kind: 'tempo', index: 1 });
    expect(session.handleIntent(second.remove!)).toBe(true);
    expect(session.doc.global.measures[1]!.tempos!.map(t => t.bpm)).toEqual([120]);
    // Without an index the popover's behaviour holds: the first is replaced.
    expect(session.handleIntent({ type: 'setMeasureAttribute', attribute: { kind: 'tempo', bpm: 90, base: 'quarter' } })).toBe(true);
    expect(session.doc.global.measures[1]!.tempos!.map(t => t.bpm)).toEqual([90]);
  });
});

describe('removePositioned takes the entry on THIS staff (bug 2)', () => {
  it('a grand staff with a dynamic on each staff at one beat removes only the cursor’s', () => {
    const q = (id: string, octave: number) => ({ duration: { base: 'quarter' as const }, notes: [{ id, pitch: { step: 'C' as const, octave } }] });
    const doc: MnxStructure = {
      mnx: { version: 1 },
      global: { measures: [{ time: { count: 4, unit: 4 } }] },
      parts: [{
        id: 'p1',
        staves: 2,
        measures: [{
          clefs: [{ clef: { sign: 'G', staffPosition: -2 } }, { clef: { sign: 'F', staffPosition: 2 }, staff: 2 }],
          sequences: [{ content: [q('a', 5)] }, { staff: 2, content: [q('b', 3)] }],
          dynamics: [
            { position: { fraction: [0, 1] }, type: 'immediate', value: 'f' },
            { position: { fraction: [0, 1] }, type: 'immediate', value: 'p', staff: 2 }
          ]
        }]
      }]
    };
    const session = new EditorSession(doc);
    session.handleIntent({ type: 'setProjection', projection: 'notation' });
    session.handleIntent({ type: 'setStaff', staffIndex: 2 });
    expect(session.cursor.staffIndex).toBe(2);
    expect(session.handleIntent({ type: 'removePositioned', kind: 'dynamic' })).toBe(true);
    expect(session.doc.parts![0]!.measures![0]!.dynamics!.map(d => d.value)).toEqual(['f']);
  });
});

describe('writers for what already rendered (core-measure-attributes-gaps.md, item 6)', () => {
  it('a segno variant at a fraction writes the glyph and the location, and reads back', () => {
    const session = atBar(1);
    const parsed = parseInspectorLine('measure', null, 'segno serpent at 1/2');
    expect(parsed).toEqual({ intent: { type: 'setMeasureAttribute', attribute: { kind: 'segno', glyph: 'segnoSerpent1', at: [1, 2] } } });
    expect(session.handleIntent((parsed as { intent: never }).intent)).toBe(true);
    expect(session.doc.global.measures[1]!.segno).toEqual({ location: { fraction: [1, 2] }, glyph: 'segnoSerpent1' });
    expect(measurePills(session.doc, 1).find(p => p.word === 'segno')?.value).toBe('serpent at 1/2');
    expect(parseInspectorLine('measure', null, 'segno banana')).toHaveProperty('error');
  });

  it('a dotted tempo unit writes dots', () => {
    expect(parseInspectorLine('measure', 'tempo', 'quarter.=60')).toEqual({
      intent: { type: 'setMeasureAttribute', attribute: { kind: 'tempo', bpm: 60, base: 'quarter', dots: 1 } }
    });
  });

  it('a symbol direction writes glyphs, not text, and reads back as `symbol`', () => {
    const session = at('event');
    const parsed = parseInspectorLine('event', null, 'symbol below keyboardPedalPed');
    expect(parsed).toEqual({ intent: { type: 'setPositioned', attribute: { kind: 'direction', text: '', glyphs: ['keyboardPedalPed'], orient: 'below' } } });
    expect(edit(session, (parsed as { intent: never }).intent)).toBe(true);
    const written = session.doc.parts![0]!.measures![0]!.directions![0] as { text?: string; glyphs?: string[] };
    expect(written.glyphs).toEqual(['keyboardPedalPed']);
    expect(written.text).toBeUndefined();
    expect(pillText(session)).toContain('symbol: below keyboardPedalPed [annotation]');
  });

  it('a beam starting at the event is a pill whose removal is the beam key’s own toggle', () => {
    const session = at('event');
    session.handleIntent({ type: 'setProjection', projection: 'notation' });
    // Beam the two quarters: one press — the point gesture beams to the
    // next note (core-selection-range-grain.md decision 5).
    session.handleIntent({ type: 'goToLevel', level: 'note' });
    expect(session.handleIntent({ type: 'toggleBeam' })).toBe(true);
    session.handleIntent({ type: 'goToLevel', level: 'event' });
    const beam = pillsFor(scope(session)).find(p => p.key === 'beam');
    expect(beam?.value).toBe('2 events');
    expect(beam?.remove).toEqual({ type: 'toggleBeam' });
    session.handleIntent({ type: 'goToLevel', level: 'note' });
    expect(session.handleIntent(beam!.remove!)).toBe(true);
    expect(session.doc.parts![0]!.measures![0]!.beams ?? []).toEqual([]);
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
    expect(pillText(session)).toEqual(['duration: quarter [floor]', 'at: 0 → 1/4 [derived]']);
    for (const text of ['staccato', 'breath comma', 'dynamic mf', 'text below cantabile', '8va 2', 'lyric sleep-']) {
      const parsed = parseInspectorLine('event', null, text);
      expect(parsed, text).toHaveProperty('intent');
      expect(edit(session, (parsed as { intent: never }).intent), text).toBe(true);
    }
    expect(pillText(session)).toEqual([
      'duration: quarter [floor]',
      'at: 0 → 1/4 [derived]',
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
      { kind: 'direction', text: '', glyphs: ['keyboardPedalPed'], orient: 'below' },
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

describe('typed technique words', () => {
  it('the camelCase words match case-insensitively — hammerPull and palmMute included', () => {
    // The typed head is lowercased, so the camelCase words never matched
    // themselves (latent since the words list was born; found hands-on
    // 2026-08-30 when `hammerPull` — offered by the error hint itself — was
    // refused).
    for (const typed of ['hammerPull', 'hammerpull', 'HAMMERPULL']) {
      expect(parseInspectorLine('note', null, typed), typed).toEqual({
        intent: { type: 'setTechnique', technique: { kind: 'hammerPull' } }
      });
    }
    expect(parseInspectorLine('note', null, 'palmmute')).toEqual({
      intent: { type: 'setTechnique', technique: { kind: 'palmMute' } }
    });
    // A trailing value still refuses — these words take none.
    expect(parseInspectorLine('note', null, 'hammerPull now')).toHaveProperty('error');
  });
});

describe('note pills', () => {
  it('read string, accidental, fingering and techniques, then the event’s own', () => {
    const session = at('note');
    // The fixture's capo 2 puts an open E4 below string 1's open — the fret is
    // honestly unplayable, and the pill says so rather than clamping.
    expect(pillText(session)).toEqual(['pitch: E4 [floor]', 'string: 1 [annotation]', 'fret: — [derived]', 'at: 0 → 1/4 [derived]']);
    for (const text of ['accidental parens', 'finger left 3', 'vibrato', 'bend 1/2>full>0', 'staccato']) {
      const parsed = parseInspectorLine('note', null, text);
      expect(parsed, text).toHaveProperty('intent');
      expect(edit(session, (parsed as { intent: never }).intent), text).toBe(true);
    }
    expect(pillText(session)).toEqual([
      'pitch: E4 [floor]',
      'string: 1 [annotation]',
      'fret: — [derived]',
      'accidental: parens [annotation]',
      'fingering: left 3 [annotation]',
      'bend: 1/2>full>0 [annotation]',
      'vibrato:  [annotation]',
      'at: 0 → 1/4 [derived]',
      'staccato:  [annotation]'
    ]);
  });

  it('a bend round-trips as its stops — pre-bend, hold, partial release, double bend, weights', () => {
    const cases: TechniqueChoice[] = [
      { kind: 'bend', alters: [0, 2] },
      { kind: 'bend', alters: [2, 2, 0] },
      { kind: 'bend', alters: [1, 3, 0] },
      { kind: 'bend', alters: [0, 2, 1] },
      { kind: 'bend', alters: [0, 1, 1, 0] },
      { kind: 'bend', alters: [0, 1, 0, 1, 0] },
      { kind: 'bend', alters: [0, 1, 0], weights: [1, 2] }
    ];
    for (const technique of cases) {
      const session = at('note');
      expect(session.handleIntent({ type: 'setTechnique', technique })).toBe(true);
      const note = session.doc.parts![0]!.measures![0]!.sequences![0]!.content[0]!.notes![0]!;
      expect(readTechniques(note), techniqueText(technique)).toEqual([technique]);
      // Typed form parses back to the same thing.
      expect(parseInspectorLine('note', 'bend', techniqueText(technique))).toEqual({ intent: { type: 'setTechnique', technique } });
      // Amend: a second set replaces rather than removing.
      expect(session.handleIntent({ type: 'setTechnique', technique: { kind: 'bend', alters: [0, 4] } })).toBe(true);
      expect(readTechniques(session.doc.parts![0]!.measures![0]!.sequences![0]!.content[0]!.notes![0]!)).toEqual([{ kind: 'bend', alters: [0, 4] }]);
    }
    // The toggle's plain form writes the curve it always wrote.
    const plain = at('note');
    plain.handleIntent({ type: 'toggleTechnique', kind: 'bend' });
    expect(plain.doc.parts![0]!.measures![0]!.sequences![0]!.content[0]!.notes![0]!._x!.mnxLab!.tab!.technique!.bend).toEqual({
      points: [{ position: 0, alter: 0 }, { position: 1, alter: 2 }]
    });
    // Weights place the points: 1:2 puts the peak a third of the way in.
    const weighted = at('note');
    weighted.handleIntent({ type: 'setTechnique', technique: { kind: 'bend', alters: [0, 2, 0], weights: [1, 2] } });
    expect(weighted.doc.parts![0]!.measures![0]!.sequences![0]!.content[0]!.notes![0]!._x!.mnxLab!.tab!.technique!.bend).toEqual({
      points: [{ position: 0, alter: 0 }, { position: 1 / 3, alter: 2 }, { position: 1, alter: 0 }]
    });
  });

  it('a foreign curve whose positions fit no small weights reads ≈, and the ≈ is tolerated on the way back in', () => {
    const doc = makeNoteDoc();
    const note = doc.parts![0]!.measures![0]!.sequences![0]!.content[0]!.notes![0]!;
    note._x = { mnxLab: { ...note._x!.mnxLab, tab: { technique: { bend: { points: [
      { position: 0, alter: 0 }, { position: 0.57, alter: 2 }, { position: 1, alter: 0 }
    ] } } } } };
    const read = readTechniques(note);
    expect(read).toEqual([{ kind: 'bend', alters: [0, 2, 0], approx: true }]);
    expect(techniqueText(read[0]!)).toBe('≈0>full>0');
    // Amending the approximated pill regularises — the mark's warning.
    expect(parseInspectorLine('note', 'bend', '≈0>full>0')).toEqual({
      intent: { type: 'setTechnique', technique: { kind: 'bend', alters: [0, 2, 0] } }
    });
  });

  it('a lone stop is shorthand for the plain rise: bend 1 reads as 0>1 — lists never get the implicit 0', () => {
    for (const [text, alters] of [
      ['1', [0, 2]],
      ['full', [0, 2]],
      ['1/2', [0, 1]]
    ] as const) {
      expect(parseInspectorLine('note', 'bend', text)).toEqual({
        intent: { type: 'setTechnique', technique: { kind: 'bend', alters: [...alters] } }
      });
    }
    // A list's first stop is the strike position — 1>0 is a pre-bend release.
    expect(parseInspectorLine('note', 'bend', '1>0')).toEqual({
      intent: { type: 'setTechnique', technique: { kind: 'bend', alters: [2, 0] } }
    });
    // The spell-back stays canonical, so the short form is input-only.
    expect(techniqueText({ kind: 'bend', alters: [0, 2] })).toBe('0>full');
  });

  it('the grammar refuses what a bend cannot be, with the reason', () => {
    for (const [text, error] of [
      ['0', 'a bend of nothing — no stop leaves 0'],
      ['0>0', 'a bend of nothing — no stop leaves 0'],
      ['0>fill', 'not a bend stop — 0 · 1/4 · 1/2 · 3/4 · full · 1 1/2 · 2'],
      ['', 'a bend is typed as its stops — 0>full · 1/2>0 · 0>full>1/2>0']
    ] as const) {
      expect(parseInspectorLine('note', 'bend', text)).toEqual({ error });
    }
    // The retired keyword forms no longer parse.
    expect(parseInspectorLine('note', 'bend', 'pre 1 2 release')).toHaveProperty('error');
    expect(parseInspectorLine('note', 'bend', 'release')).toHaveProperty('error');
  });
});

describe('the fingerboard pills (string is the choice, fret its consequence)', () => {
  /** No capo, one G4 — bare, or chosen onto string 2 (with the fret stored). */
  const fretDoc = (chosen = false): MnxStructure => ({
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [
      {
        id: 'p1',
        name: 'Guitar',
        measures: [
          {
            sequences: [
              {
                content: [
                  { duration: { base: 'quarter' }, notes: [{ id: 'n', pitch: { step: 'G', octave: 4 }, ...(chosen ? { _x: { mnxLab: { string: 2, fret: 8 } } } : {}) }] },
                  { duration: { base: 'half' }, rest: {} },
                  { duration: { base: 'quarter' }, rest: {} }
                ]
              }
            ]
          }
        ],
        _x: { mnxLab: { strings: [...STANDARD_GUITAR_STRINGS] } }
      },
      { id: 'p2', name: 'Voice', measures: [{ sequences: [{ content: [{ duration: { base: 'whole' }, rest: {} }] }] }] }
    ]
  });
  const ctx = (session: EditorSession) => {
    const noteKey = session.selectedNoteKeys[0]!;
    const note = findNoteAddress(session.doc, noteKey)!.note;
    return { pitch: note.pitch, fingerboard: fingerboardOf(session.doc, noteKey) };
  };

  it('a bare note reads a DERIVED string and fret; a chosen one reads the string as an annotation', () => {
    const session = at('note', fretDoc());
    expect(pillText(session)).toEqual(['pitch: G4 [floor]', 'string: 1 [derived]', 'fret: 3 [derived]', 'at: 0 → 1/4 [derived]']);
    expect(pillText(at('note', fretDoc(true)))).toEqual(['pitch: G4 [floor]', 'string: 2 [annotation]', 'fret: 8 [derived]', 'at: 0 → 1/4 [derived]']);
  });

  it('a part with no strings has no fingerboard pills, and the words are refused with a reason', () => {
    const session = at('note', fretDoc());
    session.handleIntent({ type: 'setPart', partIndex: 1 });
    expect(pillsFor(scope(session)).some(p => p.key === 'string' || p.key === 'fret')).toBe(false);
    expect(parseInspectorLine('note', null, 'string 2', { pitch: { step: 'G', octave: 4 }, fingerboard: null })).toHaveProperty('error');
  });

  it('`string N` keeps the pitch, writes the choice, and drops any stored fret', () => {
    const session = at('note', fretDoc());
    const parsed = parseInspectorLine('note', 'string', '2', ctx(session));
    expect(parsed).toHaveProperty('intent', { type: 'setStringAnnotation', string: 2 });
    expect(edit(session, (parsed as { intent: never }).intent)).toBe(true);
    expect(pillText(session)).toEqual(['pitch: G4 [floor]', 'string: 2 [annotation]', 'fret: 8 [derived]', 'at: 0 → 1/4 [derived]']);
    const note = findNoteAddress(session.doc, session.selectedNoteKeys[0]!)!.note;
    expect(note.pitch).toEqual({ step: 'G', octave: 4 });
    expect(note._x?.mnxLab).toEqual({ string: 2 });
  });

  it('the derived guess is never frozen: the current string, typed back, is refused as unchanged', () => {
    const session = at('note', fretDoc());
    expect(parseInspectorLine('note', 'string', '1', ctx(session))).toEqual({ error: 'already on string 1' });
    expect(parseInspectorLine('note', 'fret', '3', ctx(session))).toEqual({ error: 'already at fret 3' });
    expect(findNoteAddress(session.doc, session.selectedNoteKeys[0]!)!.note._x).toBeUndefined();
  });

  it('an unplayable string, a string the part lacks, and a fret off the neck are refused with a reason', () => {
    const session = at('note', fretDoc());
    expect(parseInspectorLine('note', 'string', '6', ctx(session))).toEqual({ error: 'G4 is not playable on string 6' });
    expect(parseInspectorLine('note', 'string', '7', ctx(session))).toEqual({ error: 'not a string — 1 to 6' });
    expect(parseInspectorLine('note', 'fret', '25', ctx(session))).toEqual({ error: 'not a fret — 0 to 24' });
    expect(session.handleIntent({ type: 'setStringAnnotation', string: 9 })).toBe(false);
  });

  it('`fret N` is the digit layer’s own entry on the current string: the pitch follows', () => {
    const session = at('note', fretDoc());
    const parsed = parseInspectorLine('note', 'fret', '5', ctx(session));
    expect(parsed).toHaveProperty('intent', { type: 'enterFret', fret: 5 });
    expect(edit(session, (parsed as { intent: never }).intent)).toBe(true);
    expect(pillText(session)).toEqual(['pitch: A4 [floor]', 'string: 1 [annotation]', 'fret: 5 [derived]', 'at: 0 → 1/4 [derived]']);
  });

  it('`fret N` from the NOTATION projection frets the note’s own string, not the staff position', () => {
    const session = at('note', fretDoc());
    expect(session.handleIntent({ type: 'setProjection', projection: 'notation' })).toBe(true);
    expect(edit(session, { type: 'enterFret', fret: 2 })).toBe(true);
    const note = findNoteAddress(session.doc, session.selectedNoteKeys[0]!)!.note;
    expect(note._x?.mnxLab).toEqual({ string: 1, fret: 2 });
    expect(note.pitch).toEqual({ step: 'F', octave: 4, alter: 1 });
  });

  it('removing the choice hands the note back to the ladder: the pill turns derived', () => {
    const session = at('note', fretDoc(true));
    const pill = pillsFor(scope(session)).find(p => p.key === 'string')!;
    expect(edit(session, pill.remove!)).toBe(true);
    expect(pillText(session)).toEqual(['pitch: G4 [floor]', 'string: 1 [derived]', 'fret: 3 [derived]', 'at: 0 → 1/4 [derived]']);
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

});

describe('the wider rungs', () => {
  it('voice-bar: full-measure rest and measure repeat', () => {
    const session = at('voiceMeasure');
    // The fill reading (one-surface item 8): the voice's clock vs the meter.
    expect(pillText(session)).toEqual(['fill: 1 of 4/4 [derived]']);
    const parsed = parseInspectorLine('voiceMeasure', null, 'measure repeat 2');
    expect(parsed).toEqual({ intent: { type: 'setMeasureRepeat', number: 2 } });
    expect(edit(session, (parsed as { intent: never }).intent)).toBe(true);
    expect(pillText(session)).toEqual(['fill: 1 of 4/4 [derived]', 'measure repeat: 2 [annotation]']);
    expect(parseInspectorLine('voiceMeasure', null, 'staccato')).toHaveProperty('error');
  });

  it('rhythm declarations and container properties (one-surface item 8)', () => {
    // Construction is a declaration: the typed text carries its own extent.
    expect(parseInspectorLine('event', null, '3:2')).toMatchObject({
      intent: { type: 'wrapInContainer', spec: { type: 'tuplet', inner: { multiple: 3 }, outer: { multiple: 2 } } }
    });
    expect(parseInspectorLine('event', null, 'grace')).toMatchObject({
      intent: { type: 'wrapInContainer', spec: { type: 'grace' } }
    });
    // The riders are voice-bar things, and the refusals signpost the rung.
    expect(parseInspectorLine('event', null, 'space 1/4')).toMatchObject({ error: expect.stringContaining('voice rung') });
    expect(parseInspectorLine('voiceMeasure', null, 'space 1/4')).toEqual({ intent: { type: 'insertSpace', duration: [1, 4] } });
    expect(parseInspectorLine('voiceMeasure', null, 'rest half')).toEqual({ intent: { type: 'setRestSpelling', duration: { base: 'half' } } });
    expect(parseInspectorLine('voiceMeasure', null, '3:2')).toMatchObject({ error: expect.stringContaining('event rung') });

    // The coincidence resolves the address: a range that IS the tuplet takes
    // setContainerProperties; presentation only, cleared by the pill's ×.
    const doc = makeNoteDoc();
    doc.parts![0]!.measures![0]!.sequences![0]!.content = [
      {
        type: 'tuplet',
        inner: { duration: { base: 'eighth' }, multiple: 3 },
        outer: { duration: { base: 'quarter' }, multiple: 1 },
        content: [
          { duration: { base: 'eighth' }, notes: [{ id: 't1', pitch: { step: 'E', octave: 4 } }] },
          { duration: { base: 'eighth' }, notes: [{ id: 't2', pitch: { step: 'F', octave: 4 } }] },
          { duration: { base: 'eighth' }, notes: [{ id: 't3', pitch: { step: 'G', octave: 4 } }] }
        ]
      } as never,
      { duration: { base: 'half' }, rest: {} },
      { duration: { base: 'quarter' }, rest: {} }
    ];
    const session = at('event', doc);
    session.handleIntent({ type: 'extendSelection', direction: 'next' });
    session.handleIntent({ type: 'extendSelection', direction: 'next' });
    expect(session.handleIntent({ type: 'setContainerProperties', properties: { bracket: 'yes' } })).toBe(true);
    const tupletOf = (d: MnxStructure) => d.parts![0]!.measures![0]!.sequences![0]!.content![0] as { bracket?: string };
    expect(tupletOf(session.doc).bracket).toBe('yes');
    // A point edit re-anchors the selection (session.apply's rule) — the page
    // puts the ladder back; the test does the same before reading pills.
    session.handleIntent({ type: 'goToLevel', level: 'event' });
    // The re-anchor left the cursor on the LAST child, so the range grows left.
    session.handleIntent({ type: 'extendSelection', direction: 'previous' });
    session.handleIntent({ type: 'extendSelection', direction: 'previous' });
    const shown = pillsFor({ doc: session.doc, level: 'event', members: session.resolvedSelection.members }).map(
      pill => `${pill.word}: ${pill.value} [${pill.pillClass}]`
    );
    expect(shown).toContain('tuplet: 3:1 eighth [derived]');
    expect(shown).toContain('bracket: yes [annotation]');
    expect(session.handleIntent({ type: 'setContainerProperties', clear: ['bracket'] })).toBe(true);
    session.handleIntent({ type: 'goToLevel', level: 'event' });
    expect(tupletOf(session.doc).bracket).toBeUndefined();
    // With no covering range there is nothing to amend — refused, not guessed.
    const bare = at('event');
    expect(bare.handleIntent({ type: 'setContainerProperties', properties: { bracket: 'no' } })).toBe(false);
  });

  it('part-bar: clef, capo, and the tuning pill (one-surface item 7)', () => {
    const session = at('partMeasure');
    expect(pillText(session)).toEqual(['capo: 2 [annotation]', 'tuning: E2 A2 D3 G3 B3 E4 [annotation]']);
    // The popover's whole grammar reaches setTuning through the typed word —
    // a preset names the entries the explicit list would.
    const tuned = parseInspectorLine('partMeasure', null, 'tuning drop-d');
    expect(tuned).toEqual({
      intent: {
        type: 'setTuning',
        tuning: [
          { string: 6, pitch: { step: 'D', octave: 2 } },
          { string: 5, pitch: { step: 'A', octave: 2 } },
          { string: 4, pitch: { step: 'D', octave: 3 } },
          { string: 3, pitch: { step: 'G', octave: 3 } },
          { string: 2, pitch: { step: 'B', octave: 3 } },
          { string: 1, pitch: { step: 'E', octave: 4 } }
        ]
      }
    });
    expect(edit(session, (tuned as { intent: never }).intent)).toBe(true);
    expect(pillText(session)[1]).toBe('tuning: D2 A2 D3 G3 B3 E4 [annotation]');
    // setTuning writes the part being READ — the popover retuned parts[0]
    // regardless; the op widened with partIndex (contract §3, ops first).
    const twoParts = makeNoteDoc();
    twoParts.parts!.push(JSON.parse(JSON.stringify(twoParts.parts![0])));
    const ensemble = new EditorSession(twoParts);
    ensemble.handleIntent({ type: 'goToLevel', level: 'partMeasure' });
    ensemble.handleIntent({ type: 'setPart', partIndex: 1 });
    ensemble.handleIntent({ type: 'setTuning', tuning: [
      { string: 3, pitch: { step: 'G', octave: 4 } },
      { string: 2, pitch: { step: 'C', octave: 4 } },
      { string: 1, pitch: { step: 'E', octave: 4 } }
    ] });
    expect(ensemble.doc.parts![1]!._x!.mnxLab!.strings!.length).toBe(3);
    expect(ensemble.doc.parts![0]!._x!.mnxLab!.strings!.length).toBe(6);
    const clef = parseInspectorLine('partMeasure', null, 'clef bass');
    expect(clef).toHaveProperty('intent');
    expect(edit(session, (clef as { intent: never }).intent)).toBe(true);
    expect(pillText(session)[0]).toBe('clef: bass [annotation]');
    // The popover's whole grammar reaches the ops through this line — the
    // retirement (one-surface campaign item 3) leans on these two forms.
    expect(parseInspectorLine('partMeasure', 'clef', 'inherit')).toEqual({ intent: { type: 'removeClef' } });
    expect(parseInspectorLine('partMeasure', 'clef', 'treble8vb')).toEqual({
      intent: { type: 'setClef', sign: 'G', staffPosition: -2, octave: -1 }
    });
    expect(parseInspectorLine('partMeasure', 'capo', '5')).toEqual({ intent: { type: 'setPartDeclaration', declaration: { kind: 'capo', value: 5 } } });
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
