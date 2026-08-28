// The rung inspector's machinery (roadmap/inprogress/workbench-rung-inspector.md):
// what a bar carries as pills, which siblings a crumb can go to, the words
// the blank slot completes to, and the typed line read back into intents.
// Lives in edit/ because it is a pure function of the document and the
// typed unions — the shell (workbench/inspectorRows.ts) only glues it to the
// HUD's row labels, and the harness exercises THIS, headlessly.
//
// Stage 3 of the roadmap: pills exist at the MEASURE rung only.
import type { MnxStructure } from '../model/mnx.ts';
import type { EditorIntent } from './intents.ts';
import { sectionRangeAt, type SelectionLevel } from './selection.ts';
import {
  MEASURE_ATTRIBUTE_FIELDS,
  readMeasureAttributes,
  type MeasureAttribute,
  type MeasureAttributeKind
} from './ops.ts';
import {
  BARLINE_TYPES,
  parseBarAttribute,
  parseKeySignature,
  parseTimeSignature
} from './setupGrammar.ts';

/** The bar's effective time signature: the last global `time` at or before it.
 *  The HUD's bar row and the inspector's `time` pill both read it. */
export function timeAt(doc: MnxStructure, measureIndex: number): { count: number; unit: number } | null {
  let time: { count: number; unit: number } | null = null;
  for (let i = 0; i <= measureIndex && i < doc.global.measures.length; i++) {
    const t = doc.global.measures[i]?.time;
    if (t) time = t;
  }
  return time;
}

/** The bar's effective key signature: the last global `key` at or before it,
 *  and WHERE it was declared — the inspector draws a key declared on this
 *  very bar as removable and an inherited one as a plain reading. */
export function keyAt(
  doc: MnxStructure,
  measureIndex: number
): { fifths: number; declaredAt: number } | null {
  let key: { fifths: number; declaredAt: number } | null = null;
  for (let i = 0; i <= measureIndex && i < doc.global.measures.length; i++) {
    const k = doc.global.measures[i]?.key;
    if (k) key = { fifths: k.fifths, declaredAt: i };
  }
  return key;
}

/** A bar attribute as the popover grammar would have taken it. */
export function attributeText(attribute: MeasureAttribute): string {
  switch (attribute.kind) {
    case 'barline':
      return `barline ${attribute.type}`;
    case 'repeatStart':
      return 'repeat start';
    case 'repeatEnd':
      return `repeat end${attribute.times !== undefined ? ` ${attribute.times}` : ''}`;
    case 'ending':
      return `ending ${(attribute.numbers ?? []).join(',')}${attribute.open ? ' open' : ''}`.trim();
    case 'segno':
      return 'segno';
    case 'fine':
      return 'fine';
    case 'jump':
      return `jump ${attribute.type}`;
    case 'tempo':
      return `tempo ${attribute.base}=${attribute.bpm}`;
    case 'rehearsal':
      return `rehearsal ${attribute.label}`;
    case 'section':
      return `section ${attribute.label}`;
  }
}

/** One rung on the cursor's path. `siblings` is null where stage 2 has no
 *  way to step (voice, container, event, note — the score's own ←/→ does). */
export interface InspectorCrumb {
  key: string;
  level: SelectionLevel;
  label: string;
  active: boolean;
  siblings: InspectorSibling[] | null;
}

export interface InspectorSibling {
  label: string;
  detail: string;
  current: boolean;
  intent: EditorIntent;
}

/**
 * The removal class decides whether a pill has a floor (the roadmap's rule):
 * - `annotation` — × removes it; Backspace clears the value first.
 * - `floor` — ▾: Backspace reverts to the floor value, and that is the end.
 * - `inherited` — a reading from an earlier bar; nothing here to remove.
 */
export type PillClass = 'annotation' | 'floor' | 'inherited';

export interface InspectorPill {
  /** Unique within the rung: the attribute kind, `#n` for the tempos array. */
  key: string;
  /** The typed word — what the blank slot would complete to. */
  word: string;
  value: string;
  pillClass: PillClass;
  /** What Backspace fires on a floor pill / the × on an annotation; null on
   *  an inherited reading. */
  remove: EditorIntent | null;
}

/** A word the blank slot can complete to, with a hint at its value. */
export interface InspectorWord {
  word: string;
  hint: string;
  /** Enumerated values, when the union enumerates them. */
  values?: string[];
}

export interface InspectorView {
  crumbs: InspectorCrumb[];
  pills: InspectorPill[];
  words: InspectorWord[];
  /** What the meta line says about the rung. */
  primary: string;
  secondary: string;
  /** Why there are no pills, when there are none by design. */
  note: string | null;
}

/** Typed words at the bar rung: the union's kinds spelt as the grammar takes
 *  them, plus the two signatures. Derived, not listed — `MEASURE_ATTRIBUTE_FIELDS`
 *  is the source of kinds, and a kind missing from WORD_OF is a red test. */
const WORD_OF: Record<MeasureAttributeKind, string> = {
  barline: 'barline',
  repeatStart: 'repeat start',
  repeatEnd: 'repeat end',
  ending: 'ending',
  segno: 'segno',
  fine: 'fine',
  jump: 'jump',
  tempo: 'tempo',
  rehearsal: 'rehearsal',
  section: 'section'
};

const HINT_OF: Record<MeasureAttributeKind, string> = {
  barline: 'double · final · dashed …',
  repeatStart: '',
  repeatEnd: 'times, e.g. 3',
  ending: '1,2 · 3 open',
  segno: 'at start · at end',
  fine: 'at start · at end',
  jump: 'segno · dsalfine',
  tempo: '120 · half=80',
  rehearsal: 'A · 12',
  section: 'Verse 1'
};

export const BAR_WORDS: InspectorWord[] = [
  { word: 'time', hint: '4/4 · 6/8 · common · cut' },
  { word: 'key', hint: 'C · Bb · F# · -3' },
  ...(Object.keys(MEASURE_ATTRIBUTE_FIELDS) as MeasureAttributeKind[]).map(kind => ({
    word: WORD_OF[kind],
    hint: HINT_OF[kind],
    ...(kind === 'barline' ? { values: [...BARLINE_TYPES] } : {})
  }))
];

const KEY_NAMES = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
/** The key as the grammar takes it back (`Bb`), so a pill's value round-trips. */
export function keyWord(fifths: number): string {
  return KEY_NAMES[fifths + 7] ?? `${fifths}`;
}

/** The value half of an attribute's typed form: `attributeText` minus its word. */
function valueOf(attribute: MeasureAttribute): string {
  const text = attributeText(attribute);
  const word = WORD_OF[attribute.kind];
  return text.startsWith(word) ? text.slice(word.length).trim() : text;
}


/** The siblings a crumb can go to: bars, parts, sections. Null where the
 *  score's own ←/→ is the only way (voice, container, event, note). */
export function crumbSiblings(
  doc: MnxStructure,
  rowKey: string,
  cursor: { measureIndex: number; partIndex?: number }
): InspectorSibling[] | null {
  if (rowKey === 'bar') {
    return doc.global.measures.map((_, index) => {
      const time = timeAt(doc, index);
      const range = sectionRangeAt(doc, index);
      const section = range ? doc.global.measures[range.start]?.section?.label : undefined;
      return {
        label: `${index + 1}${time ? ` · ${time.count}/${time.unit}` : ''}`,
        detail: section ?? '',
        current: index === cursor.measureIndex,
        intent: { type: 'goToMeasure', measureIndex: index }
      };
    });
  }
  if (rowKey === 'part') {
    const current = cursor.partIndex ?? 0;
    return (doc.parts ?? []).map((_, index) => ({
      label: partName(doc, index),
      detail: '',
      current: index === current,
      intent: { type: 'setPart', partIndex: index }
    }));
  }
  if (rowKey === 'section') {
    const here = sectionRangeAt(doc, cursor.measureIndex);
    return doc.global.measures.flatMap((measure, index) => {
      if (measure.section?.label === undefined) return [];
      const range = sectionRangeAt(doc, index);
      return [
        {
          label: measure.section.label,
          detail: range ? `m${range.start + 1}–${range.end}` : '',
          current: here?.start === index,
          intent: { type: 'goToMeasure', measureIndex: index } as EditorIntent
        }
      ];
    });
  }
  return null;
}

export function partName(doc: MnxStructure, index: number): string {
  return doc.parts?.[index]?.name ?? `part ${index + 1}`;
}

/** The bar's pills: the two signatures the bar carries, then what it declares. */
export function measurePills(doc: MnxStructure, measureIndex: number): InspectorPill[] {
  const measure = doc.global.measures[measureIndex];
  const pills: InspectorPill[] = [];
  const time = timeAt(doc, measureIndex);
  if (time) {
    const declared = measure?.time !== undefined;
    pills.push({
      key: 'time',
      word: 'time',
      value: `${time.count}/${time.unit}`,
      pillClass: declared ? 'floor' : 'inherited',
      remove: declared ? { type: 'removeTimeSignature' } : null
    });
  }
  const key = keyAt(doc, measureIndex);
  if (key) {
    const declared = key.declaredAt === measureIndex;
    pills.push({
      key: 'key',
      word: 'key',
      value: keyWord(key.fifths),
      pillClass: declared ? 'annotation' : 'inherited',
      remove: declared ? { type: 'removeKeySignature' } : null
    });
  }
  const declared = readMeasureAttributes(measure);
  const barline = declared.find(a => a.kind === 'barline');
  // Every bar draws a barline whether or not the document says so: removal
  // returns it to `regular`, so the pill is always there and has a floor.
  pills.push({
    key: 'barline',
    word: 'barline',
    value: barline ? valueOf(barline) : 'regular',
    pillClass: 'floor',
    remove: barline ? { type: 'removeMeasureAttribute', kind: 'barline' } : null
  });
  let tempoIndex = 0;
  for (const attribute of declared) {
    if (attribute.kind === 'barline') continue;
    const index = attribute.kind === 'tempo' ? tempoIndex++ : undefined;
    pills.push({
      key: index === undefined ? attribute.kind : `${attribute.kind}#${index}`,
      word: WORD_OF[attribute.kind],
      value: valueOf(attribute),
      pillClass: 'annotation',
      remove: {
        type: 'removeMeasureAttribute',
        kind: attribute.kind,
        ...(index === undefined ? {} : { index })
      }
    });
  }
  return pills;
}

export type InspectorParse = { intent: EditorIntent } | { error: string };

/**
 * The typed line → an intent. `word` is set when a pill was opened (amend):
 * the text is then the VALUE alone, and the pill's word is prepended — an
 * amend is an upsert, one op. From the blank slot the text carries its own
 * word. The bar-attribute grammar is reused for the family it already
 * parses; the two signatures have their own parsers.
 */
export function parseInspectorLine(word: string | null, text: string): InspectorParse {
  const line = (word ? `${word} ${text}` : text).trim();
  const head = line.split(/\s+/)[0]?.toLowerCase() ?? '';
  const rest = line.slice(head.length).trim();
  if (head === 'time') {
    const time = parseTimeSignature(rest);
    if (!time) return { error: 'not a time signature — 4/4, 6/8, common, cut' };
    if (time === 'inherit') return { intent: { type: 'removeTimeSignature' } };
    return {
      intent: {
        type: 'setTimeSignature',
        count: time.count,
        unit: time.unit,
        ...(time.display ? { display: time.display } : {})
      }
    };
  }
  if (head === 'key') {
    const key = parseKeySignature(rest);
    if (!key) return { error: 'not a key — C, Bb, F#, or a fifths count like -3' };
    if (key === 'inherit') return { intent: { type: 'removeKeySignature' } };
    return { intent: { type: 'setKeySignature', fifths: key.fifths } };
  }
  const parsed = parseBarAttribute(line);
  if (!parsed) return { error: `not a bar attribute — ${BAR_WORDS.map(w => w.word).join(' · ')}` };
  if ('set' in parsed) return { intent: { type: 'setMeasureAttribute', attribute: parsed.set } };
  if ('rhythm' in parsed) return { error: 'rhythm declarations stay with Shift+B for now' };
  return { intent: { type: 'removeMeasureAttribute', kind: parsed.remove } };
}
