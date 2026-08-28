// The rung inspector's machinery (roadmap/inprogress/workbench-rung-inspector.md):
// what a bar carries as pills, which siblings a crumb can go to, the words
// the blank slot completes to, and the typed line read back into intents.
// Lives in edit/ because it is a pure function of the document and the
// typed unions — the shell (workbench/inspectorRows.ts) only glues it to the
// HUD's row labels, and the harness exercises THIS, headlessly.
//
// Stages 3–5: pills at every rung the session can edit, merged over a range.
import type { MnxNote, MnxNoteValueBase, MnxStructure } from '../model/mnx.ts';
import { findNoteAddress } from '../model/noteWalk.ts';
import { midiOfSpelling } from './staffSpace.ts';
import type { EditorIntent } from './intents.ts';
import { sectionRangeAt, type SelectionLevel, type SelectionMember } from './selection.ts';
import {
  eventAtAddress,
  MEASURE_ATTRIBUTE_FIELDS,
  readMeasureAttributes,
  readPositionedAttributes,
  readTechniques,
  type MeasureAttribute,
  type MeasureAttributeKind,
  type PositionedAttribute,
  type TechniqueChoice
} from './ops.ts';
import {
  BARLINE_TYPES,
  CLEF_NAME_LIST,
  DYNAMIC_WORDS,
  MARKING_WORDS,
  parseAdornment,
  parseBarAttribute,
  parseClef,
  parseKeySignature,
  parseLyric,
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
  /** The rung window's text: the rung's name and its 1-based index — and
   *  nothing else. Identity (pitch, a section's name, the bar's time) lives
   *  in the attribute area as floor pills, so the window stays a window. */
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
  /** Over a range: set on SOME members, not all — drawn half-tone. Adding
   *  applies to all; removing strips it from the ones that have it. */
  partial?: boolean;
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

type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

/** `B3`, `F#4`, `Eb2`, `C##5` — the spelling a player types. */
export function parsePitchText(text: string): { step: Step; alter: number; octave: number } | null {
  const m = /^([a-g])(#{1,2}|b{1,2}|x)?(-?\d)$/i.exec(text.trim());
  if (!m) return null;
  const acc = m[2] ?? '';
  const alter = acc === 'x' ? 2 : acc.startsWith('#') ? acc.length : -acc.length;
  return { step: m[1]!.toUpperCase() as Step, alter, octave: Number(m[3]) };
}

/** The pitch as the same grammar spells it back. */
export function pitchText(pitch: { step: string; octave: number; alter?: number }): string {
  const alter = pitch.alter ?? 0;
  return `${pitch.step}${alter > 0 ? '#'.repeat(alter) : 'b'.repeat(-alter)}${pitch.octave}`;
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
function parseBarLine(word: string | null, text: string): InspectorParse {
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


// ── the other rungs (stage 4) and ranges (stage 5) ──────────────────────────

/** What one pill-reader needs: the document and the selection's members. */
export interface InspectorScope {
  doc: MnxStructure;
  level: SelectionLevel;
  members: readonly SelectionMember[];
}

const DURATION_WORDS: MnxNoteValueBase[] = ['whole', 'half', 'quarter', 'eighth', '16th', '32nd', '64th'];
const TECHNIQUE_WORDS: TechniqueChoice['kind'][] = ['bend', 'slide', 'hammerOn', 'pullOff', 'vibrato', 'palmMute', 'harmonic'];

function durationText(duration: { base: MnxNoteValueBase; dots?: number }): string {
  return `${duration.base}${'.'.repeat(duration.dots ?? 0)}`;
}

/** A positioned attribute's typed value — what `parseAdornment` takes back. */
export function positionedText(attribute: PositionedAttribute): { word: string; value: string } {
  if (attribute.kind === 'dynamic') {
    if (attribute.dynamicType === 'gradual')
      return { word: attribute.wedgeType === 'decreasing' ? 'dim' : 'cresc', value: '' };
    if (attribute.dynamicType === 'relative')
      return { word: attribute.relativeValue === 'softer' ? 'softer' : 'louder', value: '' };
    return { word: 'dynamic', value: attribute.value ?? (attribute.glyphs ?? []).join(' ') };
  }
  if (attribute.kind === 'ottava')
    return {
      word: attribute.value > 0 ? '8va' : '8vb',
      value: `${Math.abs(attribute.value) === 1 ? '' : `${Math.abs(attribute.value)} `}${attribute.bars ? `${attribute.bars}` : ''}`.trim()
    };
  return {
    word: 'text',
    value: `${attribute.orient && attribute.orient !== 'above' ? `${attribute.orient} ` : ''}${attribute.text}`
  };
}

/** A technique's typed value — the inspector's flattened dotted form. */
export function techniqueText(technique: TechniqueChoice): string {
  if (technique.kind !== 'bend') return '';
  return [
    technique.pre !== undefined ? `pre ${technique.pre}` : '',
    technique.semitones !== undefined ? `${technique.semitones}` : '',
    technique.release ? 'release' : ''
  ]
    .filter(Boolean)
    .join(' ');
}

function clefText(clef: { sign: string; staffPosition?: number; octave?: number }): string {
  for (const name of CLEF_NAME_LIST) {
    const parsed = parseClef(name);
    if (
      parsed &&
      parsed !== 'inherit' &&
      parsed.sign === clef.sign &&
      parsed.staffPosition === (clef.staffPosition ?? parsed.staffPosition) &&
      (parsed.octave ?? 0) === (clef.octave ?? 0)
    )
      return name;
  }
  return clef.sign;
}

const annotation = (key: string, word: string, value: string, remove: EditorIntent): InspectorPill => ({
  key, word, value, pillClass: 'annotation', remove
});
const reading = (key: string, word: string, value: string): InspectorPill => ({
  key, word, value, pillClass: 'inherited', remove: null
});

/** The pills on ONE event: its duration (a floor), its markings, the
 *  positioned attributes at its onset, its lyric lines. */
export function eventPills(doc: MnxStructure, member: Extract<SelectionMember, { kind: 'event' | 'note' }>): InspectorPill[] {
  const event = eventAtAddress(doc, member);
  if (!event) return [];
  const pills: InspectorPill[] = [];
  if (event.duration)
    pills.push({ key: 'duration', word: 'duration', value: durationText(event.duration), pillClass: 'floor', remove: null });
  for (const [name, attrs] of Object.entries(event.markings ?? {})) {
    const detail = attrs && typeof attrs === 'object' ? Object.values(attrs as Record<string, unknown>).join(' ') : '';
    pills.push(annotation(`marking:${name}`, name, detail, { type: 'removeMarking', marking: name }));
  }
  for (const { attribute } of readPositionedAttributes(doc, member, [member.onset.num, member.onset.den])) {
    const { word, value } = positionedText(attribute);
    pills.push(annotation(`positioned:${attribute.kind}`, word, value, { type: 'removePositioned', kind: attribute.kind }));
  }
  for (const [line, syllable] of Object.entries(event.lyrics?.lines ?? {})) {
    // The typed form: the hyphens say where the syllable sits in its word,
    // so the pill spells them back and the value round-trips.
    const { text = '', type } = syllable as { text?: string; type?: string };
    const spelt = `${type === 'middle' || type === 'end' ? '-' : ''}${text}${type === 'start' || type === 'middle' ? '-' : ''}`;
    pills.push(annotation(`lyric:${line}`, line === '1' ? 'lyric' : `lyric ${line}`, spelt, { type: 'removeSyllable', line }));
  }
  return pills;
}

/** The pills on ONE note: string, accidental display, fingering, techniques —
 *  then its event's, since a note is where you stand to read them. */
export function notePills(doc: MnxStructure, member: Extract<SelectionMember, { kind: 'note' }>): InspectorPill[] {
  const located = findNoteAddress(doc, member.noteKey);
  if (!located) return [];
  const note: MnxNote = located.note;
  const pills: InspectorPill[] = [];
  // Identity as a floor pill: the pitch is what the note IS. Amending it is a
  // transpose by the difference — the session's own verb, so spelling and the
  // fingerboard follow as they do for Alt+↑/↓.
  pills.push({ key: 'pitch', word: 'pitch', value: pitchText(note.pitch), pillClass: 'floor', remove: null });
  const x = note._x?.mnxLab;
  if (x?.string !== undefined)
    pills.push(annotation('string', 'string', `${x.string}`, { type: 'removeStringAnnotation' }));
  if (note.accidentalDisplay) {
    const enclosed = (note.accidentalDisplay as { enclosure?: unknown }).enclosure !== undefined;
    pills.push(annotation('accidental', 'accidental', enclosed ? 'parens' : note.accidentalDisplay.show ? 'show' : 'hide', { type: 'removeAccidentalDisplay' }));
  }
  if (x?.fingering)
    pills.push(annotation('fingering', 'fingering', `${x.fingering.hand} ${x.fingering.finger}`, { type: 'removeFingering' }));
  for (const technique of readTechniques(note))
    pills.push(annotation(`technique:${technique.kind}`, technique.kind, techniqueText(technique), { type: 'toggleTechnique', kind: technique.kind }));
  return [...pills, ...eventPills(doc, member).filter(p => p.key !== 'duration')];
}

function voiceMeasurePills(doc: MnxStructure, member: Extract<SelectionMember, { kind: 'voiceMeasure' }>): InspectorPill[] {
  const measure = doc.parts?.[member.partIndex]?.measures?.[member.measureIndex] as
    | (NonNullable<NonNullable<MnxStructure['parts']>[number]['measures']>[number] & { measureRepeat?: { number: number } })
    | undefined;
  const sequence = measure?.sequences?.[member.sequenceIndex];
  const pills: InspectorPill[] = [];
  if (sequence?.fullMeasure)
    pills.push(annotation('fullMeasureRest', 'full-measure rest', sequence.fullMeasure.visualDuration ? durationText(sequence.fullMeasure.visualDuration) : '', { type: 'removeFullMeasureRest' }));
  if (measure?.measureRepeat)
    pills.push(annotation('measureRepeat', 'measure repeat', `${measure.measureRepeat.number}`, { type: 'removeMeasureRepeat' }));
  return pills;
}

function partMeasurePills(doc: MnxStructure, member: Extract<SelectionMember, { kind: 'partMeasure' }>): InspectorPill[] {
  const part = doc.parts?.[member.partIndex];
  const measure = part?.measures?.[member.measureIndex];
  const pills: InspectorPill[] = [];
  const clef = measure?.clefs?.find(c => (c.staff ?? 1) === member.staffIndex)?.clef;
  if (clef) pills.push(annotation('clef', 'clef', clefText(clef), { type: 'removeClef' }));
  const x = part?._x?.mnxLab;
  if (x?.capo !== undefined)
    pills.push(annotation('capo', 'capo', `${x.capo}`, { type: 'removePartDeclaration', kind: 'capo' }));
  if (x?.strings?.length)
    pills.push(reading('strings', 'strings', `${x.strings.length} strings`));
  return pills;
}

function containerPills(doc: MnxStructure, member: Extract<SelectionMember, { kind: 'container' }>): InspectorPill[] {
  const sequence = doc.parts?.[member.partIndex]?.measures?.[member.measureIndex]?.sequences?.[member.sequenceIndex];
  const container = sequence?.content?.[member.eventIndex] as
    | { type: 'tuplet'; inner: { duration: { base: MnxNoteValueBase; dots?: number }; multiple: number }; outer: { duration: { base: MnxNoteValueBase; dots?: number }; multiple: number }; bracket?: string; showNumber?: string }
    | { type: 'grace'; graceType?: string; slash?: boolean }
    | { type: 'tremolo'; marks?: number }
    | undefined;
  if (!container) return [];
  // READ-ONLY: the session has no verb that rewrites a container in place
  // (core-selection-tray-residue.md, `container-properties`). Until it does,
  // the inspector shows the spec and cannot take a value.
  if (container.type === 'tuplet')
    return [
      reading('tuplet', 'tuplet', `${container.inner.multiple}:${container.outer.multiple} ${durationText(container.inner.duration)}`),
      ...(container.bracket ? [reading('bracket', 'bracket', container.bracket)] : []),
      ...(container.showNumber ? [reading('showNumber', 'number', container.showNumber)] : [])
    ];
  if (container.type === 'grace')
    return [reading('grace', 'grace', `${container.graceType ?? ''}${container.slash ? ' slash' : ''}`.trim())];
  return [reading('tremolo', 'tremolo', `${container.marks ?? ''}`)];
}

function pillsOfMember(doc: MnxStructure, level: SelectionLevel, member: SelectionMember): InspectorPill[] {
  switch (member.kind) {
    case 'measure':
      return measurePills(doc, member.measureIndex);
    case 'section': {
      // At the section rung the name is identity — a section without one is
      // not a section — so it is a floor pill: Backspace clears the value,
      // Enter on empty is refused, and there is no ×.
      const label = doc.global.measures[member.start]?.section?.label;
      return label === undefined
        ? []
        : [
            { key: 'name', word: 'name', value: label, pillClass: 'floor', remove: null },
            reading('bars', 'bars', `${member.start + 1}–${member.end}`)
          ];
    }
    case 'event':
      return eventPills(doc, member);
    case 'note':
      return level === 'event' ? eventPills(doc, member) : notePills(doc, member);
    case 'voiceMeasure':
      return voiceMeasurePills(doc, member);
    case 'partMeasure':
      return partMeasurePills(doc, member);
    case 'container':
      return containerPills(doc, member);
    case 'document':
      return [];
  }
}

/**
 * The pills for the selection: one reader per member, merged by key. A pill
 * on every member is solid; on some, `partial` (half-tone). The value shown
 * is the first member's. Removal intents already fan out over the session's
 * selection for the families that support it (markings, measure attributes,
 * fingering, accidentals, strings); the rest act at the cursor.
 */
export function pillsFor(scope: InspectorScope): InspectorPill[] {
  const { doc, level, members } = scope;
  if (members.length === 0) return [];
  const merged = new Map<string, { pill: InspectorPill; count: number }>();
  const order: string[] = [];
  for (const member of members) {
    for (const pill of pillsOfMember(doc, level, member)) {
      const seen = merged.get(pill.key);
      if (seen) seen.count++;
      else {
        merged.set(pill.key, { pill, count: 1 });
        order.push(pill.key);
      }
    }
  }
  return order.map(key => {
    const { pill, count } = merged.get(key)!;
    return count < members.length ? { ...pill, partial: true } : pill;
  });
}

const EVENT_WORDS: InspectorWord[] = [
  { word: 'duration', hint: DURATION_WORDS.join(' · '), values: [...DURATION_WORDS] },
  ...MARKING_WORDS.map(word => ({ word, hint: '' })),
  { word: 'breath', hint: 'comma · tick · upbow · salzedo' },
  { word: 'bow', hint: 'up · down' },
  { word: 'dynamic', hint: DYNAMIC_WORDS.slice(3, 11).join(' · '), values: [...DYNAMIC_WORDS] },
  { word: 'cresc', hint: '' },
  { word: 'dim', hint: '' },
  { word: 'louder', hint: '' },
  { word: 'softer', hint: '' },
  { word: 'text', hint: 'Play 8x · below cantabile' },
  { word: '8va', hint: 'bars, e.g. 2' },
  { word: '8vb', hint: 'bars, e.g. 2' },
  { word: 'lyric', hint: 'sleep- · -ing · 2: Am' }
];

const NOTE_WORDS: InspectorWord[] = [
  { word: 'pitch', hint: 'B3 · F#4 · Eb2' },
  { word: 'accidental', hint: 'show · hide · parens', values: ['show', 'hide', 'parens'] },
  { word: 'finger', hint: '3 · left 2 · right p' },
  { word: 'bend', hint: '2 · release · pre 1 2 release' },
  ...TECHNIQUE_WORDS.filter(k => k !== 'bend').map(word => ({ word, hint: '' })),
  ...EVENT_WORDS.filter(w => w.word !== 'duration')
];

const VOICE_WORDS: InspectorWord[] = [
  { word: 'full-measure rest', hint: 'whole · half' },
  { word: 'measure repeat', hint: '1 · 2 counter 3' }
];

const PART_WORDS: InspectorWord[] = [
  { word: 'clef', hint: 'treble · bass · treble8vb', values: [...CLEF_NAME_LIST] },
  { word: 'capo', hint: '3' }
];

export function wordsFor(level: SelectionLevel): InspectorWord[] {
  switch (level) {
    case 'measure':
      return BAR_WORDS;
    case 'section':
      return [{ word: 'name', hint: 'Verse 1' }];
    case 'event':
      return EVENT_WORDS;
    case 'note':
      return NOTE_WORDS;
    case 'voiceMeasure':
      return VOICE_WORDS;
    case 'partMeasure':
      return PART_WORDS;
    default:
      return [];
  }
}

/** Why a rung has no editable pills, when that is by design. */
export function rungNote(level: SelectionLevel): string | null {
  if (level === 'container') return 'a container is read here, not written — the session has no verb that rewrites one in place';
  if (level === 'document') return 'the document has no attributes to inspect yet — the crumbs walk and go to';
  return null;
}

function parseAdornmentLine(line: string, amend: boolean): InspectorParse {
  const parsed = parseAdornment(line);
  if (!parsed) return { error: `not an adornment — ${wordsFor('note').map(w => w.word).join(' · ')}` };
  if ('fingering' in parsed)
    return { intent: { type: 'setFingering', hand: parsed.fingering.hand, finger: parsed.fingering.finger } };
  if ('removeFingering' in parsed) return { intent: { type: 'removeFingering' } };
  if ('technique' in parsed) return { intent: { type: 'setTechnique', technique: parsed.technique } };
  if ('accidental' in parsed)
    return {
      intent:
        parsed.accidental === 'remove'
          ? { type: 'removeAccidentalDisplay' }
          : { type: 'setAccidentalDisplay', show: parsed.accidental.show, ...(parsed.accidental.parenthesized ? { parenthesized: true } : {}) }
    };
  if ('removeStringAnnotation' in parsed) return { intent: { type: 'removeStringAnnotation' } };
  if ('marking' in parsed)
    return {
      intent: parsed.remove
        ? { type: 'removeMarking', marking: parsed.marking }
        : { type: 'setMarking', marking: parsed.marking, ...(parsed.attributes ? { attributes: parsed.attributes } : {}) }
    };
  if ('positioned' in parsed) return { intent: { type: 'setPositioned', attribute: parsed.positioned } };
  void amend;
  return { intent: { type: 'removePositioned', kind: parsed.removePositioned } };
}

/**
 * The typed line → an intent, per rung. `word` is set when a pill was opened
 * (amend): the text is then the VALUE alone and the pill's word is
 * prepended — an upsert, one op. From the blank slot the text carries its own
 * word. Each rung reuses the grammar its popover already had; the inspector
 * adds only the words the grammars never needed (`duration`, the bare
 * technique kinds, `lyric`).
 */
export function parseInspectorLine(
  level: SelectionLevel,
  word: string | null,
  text: string,
  context?: { pitch?: { step: string; octave: number; alter?: number }; key?: string; tempoCount?: number }
): InspectorParse {
  if (level === 'measure') {
    const parsed = parseBarLine(word, text);
    // An amend of `tempo#N` names its entry; an add from the slot appends.
    const index = context?.key ? Number(/^tempo#(\d+)$/.exec(context.key)?.[1]) : NaN;
    if ('intent' in parsed && parsed.intent.type === 'setMeasureAttribute' && parsed.intent.attribute.kind === 'tempo') {
      if (!Number.isNaN(index)) return { intent: { ...parsed.intent, index } };
      if (word === null && context?.tempoCount !== undefined) return { intent: { ...parsed.intent, index: context.tempoCount } };
    }
    return parsed;
  }
  const line = (word ? `${word} ${text}` : text).trim();
  const head = line.split(/\s+/)[0]?.toLowerCase() ?? '';
  const rest = line.slice(head.length).trim();
  if (level === 'section') {
    if (head !== 'name' && head !== 'section') return { error: 'a section has a name — name Verse 1' };
    if (rest === '') return { error: 'a section needs a name' };
    return { intent: { type: 'setMeasureAttribute', attribute: { kind: 'section', label: rest } } };
  }
  if ((level === 'note' || level === 'event') && head === 'pitch') {
    const parsed = parsePitchText(rest);
    if (!parsed) return { error: 'not a pitch — B3 · F#4 · Eb2' };
    if (!context?.pitch) return { error: 'no note under the cursor to re-pitch' };
    const from = midiOfSpelling(context.pitch.step as Step, context.pitch.octave, context.pitch.alter ?? 0);
    const to = midiOfSpelling(parsed.step, parsed.octave, parsed.alter);
    if (to === from) return { error: 'already that pitch' };
    return { intent: { type: 'transpose', semitones: to - from } };
  }
  if (level === 'event' || level === 'note') {
    if (head === 'duration') {
      const m = /^([a-z0-9]+)(\.*)$/i.exec(rest);
      const base = m && (DURATION_WORDS as string[]).includes(m[1]!) ? (m[1] as MnxNoteValueBase) : null;
      if (!base) return { error: `not a duration — ${DURATION_WORDS.join(' · ')}` };
      return { intent: { type: 'setEventDuration', base, ...(m![2] ? { dots: m![2].length } : {}) } };
    }
    if (head === 'lyric' || /^lyric$/i.test(word ?? '') || /^lyric \d+$/i.test(word ?? '')) {
      const lineId = /^lyric (\d+)$/i.exec(word ?? '')?.[1];
      const parsed = parseLyric(lineId ? `${lineId}: ${rest}` : rest);
      if (!parsed || !('syllable' in parsed)) return { error: 'not a syllable — sleep- · -ing · 2: Am' };
      return { intent: { type: 'setSyllable', line: parsed.line, text: parsed.syllable, ...(parsed.syllableType ? { syllableType: parsed.syllableType } : {}) } };
    }
    if (head === 'string') return { error: 'the string is chosen with the digits on the tab staff' };
    if ((TECHNIQUE_WORDS as string[]).includes(head) && head !== 'bend' && rest === '')
      return { intent: { type: 'setTechnique', technique: { kind: head as TechniqueChoice['kind'] } as TechniqueChoice } };
    // The pills' words are nouns; the grammar's are bare values (`mf`,
    // `left 3`). Strip the noun so an amend composes what the grammar takes.
    if (head === 'fingering' || head === 'finger')
      return parseAdornmentLine(/^(left|right)\b/.test(rest) ? rest : `finger ${rest}`, word !== null);
    if (head === 'dynamic') return parseAdornmentLine(rest, word !== null);
    return parseAdornmentLine(line, word !== null);
  }
  if (level === 'voiceMeasure') {
    const parsed = parseBarAttribute(line);
    if (!parsed || !('rhythm' in parsed)) return { error: 'not a rhythm declaration — full-measure rest · measure repeat 2' };
    if (parsed.rhythm === 'fullMeasureRest')
      return { intent: parsed.remove ? { type: 'removeFullMeasureRest' } : { type: 'setFullMeasureRest', ...(parsed.visualDuration ? { visualDuration: parsed.visualDuration } : {}) } };
    return { intent: parsed.remove ? { type: 'removeMeasureRepeat' } : { type: 'setMeasureRepeat', number: parsed.number ?? 1, ...(parsed.counter ? { counter: parsed.counter } : {}) } };
  }
  if (level === 'partMeasure') {
    if (head === 'clef') {
      const clef = parseClef(rest);
      if (!clef) return { error: 'not a clef — treble · bass · treble8vb · inherit' };
      if (clef === 'inherit') return { intent: { type: 'removeClef' } };
      return { intent: { type: 'setClef', sign: clef.sign, ...(clef.staffPosition !== undefined ? { staffPosition: clef.staffPosition } : {}), ...(clef.octave ? { octave: clef.octave } : {}) } };
    }
    if (head === 'capo') {
      const n = Number(rest);
      if (!Number.isInteger(n) || n < 0) return { error: 'capo takes a fret number' };
      return { intent: { type: 'setPartDeclaration', declaration: { kind: 'capo', value: n } } };
    }
    return { error: 'not a part declaration — clef · capo' };
  }
  return { error: rungNote(level) ?? 'nothing to set at this rung' };
}
