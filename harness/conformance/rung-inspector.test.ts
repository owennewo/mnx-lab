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
  timeAt
} from '../../src/edit/inspector.ts';

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
      const parsed = parseInspectorLine(null, attributeText(attribute));
      expect(parsed, attribute.kind).toEqual({
        intent: { type: 'setMeasureAttribute', attribute }
      });
    }
  });

  it('an amend prepends the pill’s word — one op, an upsert', () => {
    expect(parseInspectorLine('tempo', 'half=80')).toEqual({
      intent: { type: 'setMeasureAttribute', attribute: { kind: 'tempo', bpm: 80, base: 'half' } }
    });
    expect(parseInspectorLine('time', '3/4')).toEqual({
      intent: { type: 'setTimeSignature', count: 3, unit: 4 }
    });
    expect(parseInspectorLine('key', keyWord(3))).toEqual({
      intent: { type: 'setKeySignature', fifths: 3 }
    });
    expect(parseInspectorLine('key', 'inherit')).toEqual({ intent: { type: 'removeKeySignature' } });
  });

  it('says why a line was refused rather than doing nothing', () => {
    expect(parseInspectorLine(null, 'banana')).toMatchObject({ error: expect.stringContaining('not a bar attribute') });
    expect(parseInspectorLine('time', 'x')).toMatchObject({ error: expect.stringContaining('time signature') });
    expect(parseInspectorLine(null, 'full-measure rest')).toMatchObject({ error: expect.stringContaining('Shift+B') });
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
