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
import { capoOf, defaultStringFor, isTabPart, midiOfPitch, tuningOf } from './tabStrings.ts';
import type { EditorIntent } from './intents.ts';
import { addOnsets, durationSpan, itemSpan } from './cursor.ts';
import { containerCoincidence, sectionRangeAt, type SelectionLevel, type SelectionMember } from './selection.ts';
import {
  beamStartingAt,
  eventAtAddress,
  MEASURE_ATTRIBUTE_FIELDS,
  readMeasureAttributes,
  readPositionedAttributes,
  readTechniques,
  type MarkAt,
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
  bendStopText,
  parseBendStops,
  fermataText,
  parseClef,
  parseKeySignature,
  parseLyric,
  parseTimeSignature,
  parseTuning,
  parsePart,
  parsePartDeclaration,
  parseLayoutSentence,
  parseRhythm,
  RHYTHM_HELP
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
      return `segno${attribute.glyph ? ` ${segnoWord(attribute.glyph)}` : ''}${markAtText(attribute.at)}`;
    case 'fine':
      return `fine${markAtText(attribute.at)}`;
    case 'fermata': {
      const { kind: _kind, ...fermata } = attribute;
      return `fermata ${fermataText(fermata)}`.trim();
    }
    case 'number':
      return `number ${attribute.value}`;
    case 'jump':
      return `jump ${attribute.type}${markAtText(attribute.at)}`;
    case 'tempo':
      return `tempo ${attribute.base}${'.'.repeat(attribute.dots ?? 0)}=${attribute.bpm}${markAtText(attribute.at)}`;
    case 'rehearsal':
      return `rehearsal ${attribute.label}`;
    case 'section':
      return `section ${attribute.label}`;
    case 'harmony':
      return `chord ${attribute.text}${markAtText(attribute.at)}`;
  }
}

/** ` at end` / ` at 1/2` — the grammar's own spelling, empty for the default. */
function markAtText(at: MarkAt | undefined): string {
  if (at === undefined) return '';
  return ` at ${Array.isArray(at) ? `${at[0]}/${at[1]}` : at}`;
}

/** The word the grammar takes for a segno glyph, else the SMuFL name itself. */
function segnoWord(glyph: string): string {
  return { segnoSerpent1: 'serpent', segnoSerpent2: 'serpent2', segnoJapanese: 'japanese' }[glyph] ?? glyph;
}

/** The beam object a `beamStartingAt` result names. */
function beamAtPath(doc: MnxStructure, at: { measureIndex: number; path: number[]; partIndex: number }) {
  let list = doc.parts?.[at.partIndex]?.measures?.[at.measureIndex]?.beams;
  let beam: { events: string[]; beams?: unknown[] } | undefined;
  for (const index of at.path) {
    beam = list?.[index] as typeof beam;
    list = beam?.beams as typeof list;
  }
  return beam;
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
 * - `derived` — a value the document did not say and the renderer worked out
 *   (the string the ladder chose, the fret that string implies). Drawn
 *   dotted like a reading, but OPENABLE: typing a different value is the
 *   choice being made. Committing it unchanged writes nothing — the guess is
 *   correct until the player says otherwise, so there is no "freeze".
 */
export type PillClass = 'annotation' | 'floor' | 'inherited' | 'derived';

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
  fermata: 'fermata',
  number: 'number',
  jump: 'jump',
  tempo: 'tempo',
  rehearsal: 'rehearsal',
  section: 'section',
  harmony: 'chord'
};

const HINT_OF: Record<MeasureAttributeKind, string> = {
  barline: 'double · final · dashed …',
  repeatStart: '',
  repeatEnd: 'times, e.g. 3',
  ending: '1,2 · 3 open',
  segno: 'serpent · at end · at 1/2',
  fine: 'at start · at end · at 3/4',
  fermata: 'square · long · below',
  number: '12',
  jump: 'segno · dsalfine · at 1/2',
  tempo: '120 · half=80 · quarter.=60 · 96 at 1/2',
  rehearsal: 'A · 12',
  section: 'Verse 1',
  harmony: 'Am7 · D/F# at 1/2 · N.C.'
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


/** The siblings a crumb can go to: bars and parts. Null where the score's
 *  own ←/→ is the only way (voice, container, event, note). */
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
  const counters: Partial<Record<MeasureAttributeKind, number>> = {};
  for (const attribute of declared) {
    if (attribute.kind === 'barline') continue;
    const index = attribute.kind === 'tempo' || attribute.kind === 'harmony' ? (counters[attribute.kind] = (counters[attribute.kind] ?? 0) + 1) - 1 : undefined;
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
  if ('rhythm' in parsed) return { error: 'a voice-bar thing — tighten to the voice rung: full-measure rest · measure repeat 2' };
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
const TECHNIQUE_WORDS: TechniqueChoice['kind'][] = ['bend', 'slide', 'hammerPull', 'vibrato', 'palmMute', 'harmonic'];

/** A bar-relative fraction, whole-note units — `0`, `1/4`, `3/8`. */
function fractionText(onset: { num: number; den: number }): string {
  return onset.num === 0 ? '0' : onset.den === 1 ? `${onset.num}` : `${onset.num}/${onset.den}`;
}

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
  if (attribute.kind === 'arpeggio')
    return { word: 'arpeggio', value: [attribute.direction, attribute.arrow ? 'arrow' : undefined].filter(Boolean).join(' ') };
  if (attribute.kind === 'nonArpeggio') return { word: 'non-arpeggio', value: '' };
  if (attribute.kind === 'ottava')
    return {
      word: attribute.value > 0 ? '8va' : '8vb',
      value: `${Math.abs(attribute.value) === 1 ? '' : `${Math.abs(attribute.value)} `}${attribute.bars ? `${attribute.bars}` : ''}`.trim()
    };
  if (attribute.glyphs?.length)
    return {
      word: 'symbol',
      value: `${attribute.orient ? `${attribute.orient} ` : ''}${attribute.glyphs[0]}`
    };
  return {
    word: 'text',
    value: `${attribute.orient && attribute.orient !== 'above' ? `${attribute.orient} ` : ''}${attribute.text}`
  };
}

/** A technique's typed value: a bend as its stops, `≈`-marked when the
 *  stored positions are only approximated by the spelt weights. */
export function techniqueText(technique: TechniqueChoice): string {
  if (technique.kind === 'slide') return technique.slideType ?? '';
  if (technique.kind !== 'bend') return '';
  let out = technique.approx ? '≈' : '';
  technique.alters.forEach((alter, i) => {
    if (i > 0) out += '>'.repeat(technique.weights?.[i - 1] ?? 1);
    out += bendStopText(alter);
  });
  return out;
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
const derived = (key: string, word: string, value: string): InspectorPill => ({
  key, word, value, pillClass: 'derived', remove: null
});

/** Where a note sits on its part's fingerboard: the string (chosen by the
 *  document, else the ladder's default) and the fret that string implies for
 *  the pitch — `null` when the pitch is not playable there. Null altogether
 *  when the part has no fingerboard: no instrument is ever assumed. */
export interface Fingerboard {
  string: number;
  /** The document chose the string (an annotation), as opposed to derived. */
  chosen: boolean;
  fret: number | null;
  tuning: ReturnType<typeof tuningOf>;
  capo: number;
}

export const MAX_FRET = 24;

export function fretOn(fb: Pick<Fingerboard, 'tuning' | 'capo'>, string: number, pitch: MnxNote['pitch']): number | null {
  const entry = fb.tuning.find(t => t.string === string);
  if (!entry) return null;
  const fret = midiOfPitch(pitch) - (midiOfPitch(entry.pitch) + fb.capo);
  return fret < 0 || fret > MAX_FRET ? null : fret;
}

export function fingerboardOf(doc: MnxStructure, noteKey: string): Fingerboard | null {
  const located = findNoteAddress(doc, noteKey);
  if (!located) return null;
  const part = doc.parts?.[located.partIndex];
  if (!isTabPart(part)) return null;
  const tuning = tuningOf(part);
  const capo = capoOf(part);
  const annotated = located.note._x?.mnxLab?.string;
  const string = annotated ?? defaultStringFor(located.note.pitch, tuning, capo);
  return { string, chosen: annotated !== undefined, fret: fretOn({ tuning, capo }, string, located.note.pitch), tuning, capo };
}

/** The pills on ONE event: its duration (a floor), its markings, the
 *  positioned attributes at its onset, its lyric lines. */
export function eventPills(doc: MnxStructure, member: Extract<SelectionMember, { kind: 'event' | 'note' }>): InspectorPill[] {
  const event = eventAtAddress(doc, member);
  if (!event) return [];
  const pills: InspectorPill[] = [];
  if (event.duration) {
    pills.push({ key: 'duration', word: 'duration', value: durationText(event.duration), pillClass: 'floor', remove: null });
    // Where the event sits in its bar (whole-note fractions) — a reading, so
    // over/underfull bars can be audited event by event (one-surface item 8).
    const ends = addOnsets(member.onset, durationSpan(event.duration));
    pills.push(derived('at', 'at', `${fractionText(member.onset)} → ${fractionText(ends)}`));
  }
  for (const [name, attrs] of Object.entries(event.markings ?? {})) {
    const detail = attrs && typeof attrs === 'object' ? Object.values(attrs as Record<string, unknown>).join(' ') : '';
    pills.push(annotation(`marking:${name}`, name, detail, { type: 'removeMarking', marking: name }));
  }
  if (event.fermata)
    pills.push(annotation('fermata', 'fermata', fermataText(event.fermata), { type: 'removeFermata' }));
  for (const { attribute } of readPositionedAttributes(doc, member, [member.onset.num, member.onset.den])) {
    const { word, value } = positionedText(attribute);
    pills.push(annotation(`positioned:${attribute.kind}`, word, value, { type: 'removePositioned', kind: attribute.kind }));
  }
  // A beam that STARTS at this event: one pill, its length; removing it is
  // the beam key's own toggle on this note (the session's path 2).
  const firstNoteId = event.notes?.[0]?.id;
  const beam = firstNoteId ? beamStartingAt(doc, firstNoteId) : null;
  if (beam) {
    const list = beamAtPath(doc, beam);
    pills.push(annotation('beam', 'beam', `${list?.events.length ?? '?'} events`, { type: 'toggleBeam' }));
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
  // The fingerboard: the string is the one CHOICE (solid, removable, when the
  // document made it; dotted-derived when the ladder did), and the fret is
  // its consequence — always derived, never stored as a second choice.
  const fb = fingerboardOf(doc, member.noteKey);
  if (fb) {
    pills.push(fb.chosen
      ? annotation('string', 'string', `${fb.string}`, { type: 'removeStringAnnotation' })
      : derived('string', 'string', `${fb.string}`));
    pills.push(derived('fret', 'fret', fb.fret === null ? '—' : `${fb.fret}`));
  }
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
  if (sequence) {
    // The voice's clock against the bar's meter — the adds-up-to-the-time-
    // signature check at a glance. itemSpan is the enclosing voice clock, so
    // container children don't double-count and grace content reads 0.
    const total = (sequence.content ?? []).reduce((sum, item) => addOnsets(sum, itemSpan(item)), { num: 0, den: 1 });
    const time = timeAt(doc, member.measureIndex);
    if (time) pills.push(derived('fill', 'fill', `${fractionText(total)} of ${time.count}/${time.unit}`));
  }
  if (measure?.measureRepeat) {
    const mr = measure.measureRepeat as { number: number; counter?: { count: number; orient?: string } };
    const counter = mr.counter ? ` counter ${mr.counter.count}${mr.counter.orient === 'below' ? ' below' : ''}` : '';
    pills.push(annotation('measureRepeat', 'measure repeat', `${mr.number}${counter}`, { type: 'removeMeasureRepeat' }));
  }
  return pills;
}

function partMeasurePills(doc: MnxStructure, member: Extract<SelectionMember, { kind: 'partMeasure' }>): InspectorPill[] {
  const part = doc.parts?.[member.partIndex];
  const measure = part?.measures?.[member.measureIndex];
  const pills: InspectorPill[] = [];
  // The member is the whole part's bar, so every staff's clef reads here.
  (measure?.clefs ?? []).forEach(entry => {
    const staff = entry.staff ?? 1;
    pills.push(annotation(`clef${staff}`, 'clef', clefText(entry.clef), { type: 'removeClef' }));
  });
  if (part?.name)
    pills.push(annotation('name', 'name', part.name, { type: 'removePartDeclaration', kind: 'name' }));
  if (part?.staves !== undefined)
    pills.push(annotation('staves', 'staves', `${part.staves}`, { type: 'removePartDeclaration', kind: 'staves' }));
  const x = part?._x?.mnxLab;
  if (x?.tab?.staffKind)
    pills.push(annotation('staffKind', 'staff kind', x.tab.staffKind, { type: 'removePartDeclaration', kind: 'staffKind' }));
  if (x?.capo !== undefined)
    pills.push(annotation('capo', 'capo', `${x.capo}`, { type: 'removePartDeclaration', kind: 'capo' }));
  if (x?.strings?.length) {
    // Recited low string first, the way parseTuning takes it back — string N
    // is the lowest, so declared entries read in descending string order.
    const recited = [...x.strings].sort((a, b) => b.string - a.string).map(entry => pitchText(entry.pitch));
    pills.push(annotation('strings', 'tuning', recited.join(' '), { type: 'removePartDeclaration', kind: 'strings' }));
  }
  return pills;
}

function pillsOfMember(doc: MnxStructure, level: SelectionLevel, member: SelectionMember): InspectorPill[] {
  switch (member.kind) {
    case 'measure':
      return measurePills(doc, member.measureIndex);
    case 'event':
      return eventPills(doc, member);
    case 'note':
      return level === 'event' ? eventPills(doc, member) : notePills(doc, member);
    case 'voiceMeasure':
      return voiceMeasurePills(doc, member);
    case 'partMeasure':
      return partMeasurePills(doc, member);
    case 'document':
      return documentPills(doc);
  }
}

/** The document rung's pills: the explicit-marking support flags
 *  (`mnx.support`) and the lyric verse lines (`global.lyrics.lineMetadata`) —
 *  declared-only, like every other pill family. */
function documentPills(doc: MnxStructure): InspectorPill[] {
  const support = doc.mnx?.support ?? {};
  const pills: InspectorPill[] = [];
  if (support.useAccidentalDisplay)
    pills.push(annotation('explicitAccidentals', 'explicit accidentals', 'on', { type: 'setSupport', key: 'useAccidentalDisplay', value: false }));
  if (support.useBeams)
    pills.push(annotation('explicitBeams', 'explicit beams', 'on', { type: 'setSupport', key: 'useBeams', value: false }));
  // Verse-line metadata is document-level in MNX (labels + languages live
  // under global.lyrics, stacked by lineOrder), so its pills sit here — the
  // one-surface item 6 minimum bar. Recited in lineOrder, unlisted ids after,
  // mirroring the renderer's stacking rule.
  const lyrics = doc.global?.lyrics;
  const metadata = lyrics?.lineMetadata ?? {};
  const order = lyrics?.lineOrder ?? [];
  const ids = [...order.filter(id => id in metadata), ...Object.keys(metadata).filter(id => !order.includes(id)).sort()];
  for (const id of ids) {
    const { label, lang } = metadata[id]!;
    const value = [label, lang ? `(${lang})` : ''].filter(Boolean).join(' ');
    pills.push(annotation(`line:${id}`, `line ${id}`, value, { type: 'removeLyricLine', line: id }));
  }
  // The presentation layer, summarized — amend is retyping the sentence
  // (upsert by id/slot, the popover's own model), so no tree round-trip.
  (doc.layouts ?? []).forEach((layout, index) => {
    const kinds = (layout.content ?? []).map(entry => entry.type).join(' ');
    pills.push(annotation(`layout#${index}`, 'layout', `${index + 1}${layout.id ? ` «${layout.id}»` : ''} · ${kinds || 'empty'} · ${countLayoutSources(layout.content)} sources`, { type: 'removeLayout', index }));
  });
  (doc.scores ?? []).forEach((score, index) => {
    pills.push(annotation(`score#${index}`, 'score', `${index + 1}${score.name ? ` «${score.name}»` : ''}`, { type: 'removeScore', index }));
    (score.multimeasureRests ?? []).forEach((rest, restIndex) => {
      pills.push(annotation(`mmrest#${index}:${restIndex}`, 'mmrest', `${rest.start} ×${rest.duration}${index > 0 ? ` in ${index + 1}` : ''}`, { type: 'removeMultimeasureRest', scoreIndex: index, index: restIndex }));
    });
  });
  return pills;
}

function countLayoutSources(content: readonly { content?: unknown; sources?: unknown[] }[] | undefined): number {
  let count = 0;
  for (const entry of content ?? []) {
    count += entry.sources?.length ?? 0;
    if (Array.isArray(entry.content)) count += countLayoutSources(entry.content as never);
  }
  return count;
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
  const pills = order.map(key => {
    const { pill, count } = merged.get(key)!;
    return count < members.length ? { ...pill, partial: true } : pill;
  });
  // The coincidence rule's settings offer (range-grain decision 5): a range
  // that IS a container carries that container's presentation pills. The
  // session re-resolves the address when a pill fires, so these intents stay
  // address-free like every other typed line.
  if (level === 'event') {
    const coincidence = containerCoincidence(doc, members);
    if (coincidence.exact && coincidence.whole.length === 1) {
      const hit = coincidence.whole[0];
      const item = doc.parts?.[hit.partIndex]?.measures?.[hit.measureIndex]
        ?.sequences?.[hit.sequenceIndex]?.content?.[hit.eventIndex];
      if (item && 'type' in item && item.type === 'tuplet') {
        pills.push(derived('container', 'tuplet', `${item.inner.multiple}:${item.outer.multiple} ${item.inner.duration.base}`));
        if (item.bracket) pills.push(annotation('bracket', 'bracket', item.bracket, { type: 'setContainerProperties', clear: ['bracket'] }));
        if (item.showNumber) pills.push(annotation('number', 'number', item.showNumber, { type: 'setContainerProperties', clear: ['showNumber'] }));
      } else if (item && 'type' in item && item.type === 'grace') {
        pills.push(derived('container', 'grace', item.graceType ?? 'stealFollowing'));
        if (item.slash !== undefined) pills.push(annotation('slash', 'slash', item.slash ? 'yes' : 'no', { type: 'setContainerProperties', clear: ['slash'] }));
      } else if (item && 'type' in item && item.type === 'tremolo') {
        pills.push(derived('container', 'tremolo', `${item.marks ?? 3} marks`));
        if (item.marks !== undefined) pills.push(annotation('marks', 'marks', `${item.marks}`, { type: 'setContainerProperties', clear: ['marks'] }));
      }
    }
  }
  return pills;
}

const EVENT_WORDS: InspectorWord[] = [
  { word: 'duration', hint: DURATION_WORDS.join(' · '), values: [...DURATION_WORDS] },
  { word: 'tuplet', hint: '3:2 · 3 eighth in 1 quarter, no number' },
  { word: 'grace', hint: 'grace · grace 2 · appoggiatura · acciaccatura' },
  { word: 'tremolo', hint: '2 · 3 in 2 half' },
  { word: 'bracket', hint: 'yes · no · auto', values: ['yes', 'no', 'auto'] },
  { word: 'number', hint: 'inner · both · none', values: ['inner', 'both', 'none'] },
  { word: 'slash', hint: 'yes · no', values: ['yes', 'no'] },
  { word: 'marks', hint: '2 · 3' },
  ...MARKING_WORDS.map(word => ({ word, hint: '' })),
  { word: 'breath', hint: 'comma · tick · upbow · salzedo' },
  { word: 'bow', hint: 'up · down' },
  { word: 'dynamic', hint: DYNAMIC_WORDS.slice(3, 11).join(' · '), values: [...DYNAMIC_WORDS] },
  { word: 'cresc', hint: '' },
  { word: 'dim', hint: '' },
  { word: 'louder', hint: '' },
  { word: 'softer', hint: '' },
  { word: 'text', hint: 'Play 8x · below cantabile' },
  { word: 'symbol', hint: 'keyboardPedalPed · below keyboardPedalUp' },
  { word: 'arpeggio', hint: 'up · down · arrow' },
  { word: 'non-arpeggio', hint: '' },
  { word: '8va', hint: 'bars, e.g. 2' },
  { word: '8vb', hint: 'bars, e.g. 2' },
  { word: 'lyric', hint: 'sleep- · -ing · 2: Am' }
];

const NOTE_WORDS: InspectorWord[] = [
  { word: 'pitch', hint: 'B3 · F#4 · Eb2' },
  { word: 'string', hint: '1 = highest · pitch kept' },
  { word: 'fret', hint: '0 · 12 · on the current string' },
  { word: 'accidental', hint: 'show · hide · parens', values: ['show', 'hide', 'parens'] },
  { word: 'finger', hint: '3 · left 2 · right p' },
  { word: 'bend', hint: '0>full · 1/2>0 · 0>full>1/2 · 0>1/2>1/2>0' },
  ...TECHNIQUE_WORDS.filter(k => k !== 'bend').map(word => ({ word, hint: word === 'slide' ? 'shift · legato — bare = legato' : '' })),
  ...EVENT_WORDS.filter(w => w.word !== 'duration')
];

const VOICE_WORDS: InspectorWord[] = [
  { word: 'full-measure rest', hint: 'whole · half' },
  { word: 'measure repeat', hint: '1 · 2 counter 3' },
  { word: 'space', hint: '1/4 · 3/8' },
  { word: 'rest', hint: 'half · quarter.' },
  // Construction as declaration, the campaign's proven move (items 7–10):
  // the last bespoke construct verb becomes a word. Offered at the part rung
  // too — the voice rung does not exist until a voice does.
  { word: 'voice', hint: 'adds the next voice to this bar' }
];

const PART_WORDS: InspectorWord[] = [
  { word: 'name', hint: 'Lead Guitar — `no name` makes it anonymous' },
  { word: 'staves', hint: '1 · 2' },
  { word: 'staff kind', hint: 'tab · notation · both', values: ['tab', 'notation', 'both'] },
  { word: 'clef', hint: 'treble · bass · treble8vb', values: [...CLEF_NAME_LIST] },
  { word: 'capo', hint: '3' },
  // Offered on ANY part: declaring a fingerboard is the user's call — the
  // no-instrument-assumed rule governs derivation, never declaration.
  { word: 'tuning', hint: 'standard · drop-d · D2 A2 D3 G3 A3 D4' },
  { word: 'voice', hint: 'adds the next voice to this bar' }
];

const DOC_WORDS: InspectorWord[] = [
  // Construction as declaration (contract §2, argued at items 7–8): the name
  // declares the member; empty is the anonymous part MNX allows.
  { word: 'part', hint: 'Lead Guitar — adds a part; empty = anonymous' },
  { word: 'explicit accidentals', hint: 'print what each note asks; `no explicit accidentals` reverts' },
  { word: 'explicit beams', hint: 'beam exactly as written' },
  { word: 'line', hint: 'line 2 Nederlands nl — a verse line’s label + language; `no line 2` removes' },
  { word: 'layout', hint: 'L1: bracket [ vn1, vn2 ] — upsert by id, `no layout 2` strips' },
  { word: 'score', hint: '"Part A": layout L1' },
  { word: 'mmrest', hint: 'm3 x2 · m3 x2 in 2' }
];

export function wordsFor(level: SelectionLevel): InspectorWord[] {
  switch (level) {
    case 'measure':
      return BAR_WORDS;
    case 'event':
      return EVENT_WORDS;
    case 'note':
      return NOTE_WORDS;
    case 'voiceMeasure':
      return VOICE_WORDS;
    case 'partMeasure':
      return PART_WORDS;
    case 'document':
      return DOC_WORDS;
    default:
      return [];
  }
}

/** Why a rung has no editable pills, when that is by design. */
export function rungNote(level: SelectionLevel): string | null {
  // The document rung earned its pills with one-surface item 9 (part
  // construction and the support flags), so it no longer pleads empty.
  void level;
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
  if ('fermata' in parsed) return { intent: { type: 'setFermata', fermata: parsed.fermata } };
  if ('removeFermata' in parsed) return { intent: { type: 'removeFermata' } };
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
  context?: {
    pitch?: { step: string; octave: number; alter?: number };
    /** The note's place on its part's strings, when the part has any. */
    fingerboard?: Fingerboard | null;
    key?: string;
    tempoCount?: number;
    harmonyCount?: number;
    /** Declared layout ids / score names, in slot order — the document
     *  rung's upsert-by-id resolution (the popover's own rule). */
    layoutIds?: (string | undefined)[];
    scoreNames?: (string | undefined)[];
  }
): InspectorParse {
  if (level === 'measure') {
    const parsed = parseBarLine(word, text);
    // An amend of `tempo#N` / `harmony#N` names its entry; an add from the
    // slot appends — the two array-valued kinds.
    const index = context?.key ? Number(/^(?:tempo|harmony)#(\d+)$/.exec(context.key)?.[1]) : NaN;
    if ('intent' in parsed && parsed.intent.type === 'setMeasureAttribute') {
      const kind = parsed.intent.attribute.kind;
      const count = kind === 'tempo' ? context?.tempoCount : kind === 'harmony' ? context?.harmonyCount : undefined;
      if (kind === 'tempo' || kind === 'harmony') {
        if (!Number.isNaN(index)) return { intent: { ...parsed.intent, index } };
        if (word === null && count !== undefined) return { intent: { ...parsed.intent, index: count } };
      }
    }
    return parsed;
  }
  const line = (word ? `${word} ${text}` : text).trim();
  const head = line.split(/\s+/)[0]?.toLowerCase() ?? '';
  const rest = line.slice(head.length).trim();
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
      if (parsed && !('syllable' in parsed) && ('line' in parsed || 'removeLine' in parsed))
        return { error: 'a document thing — widen to the document rung: line 2 Nederlands nl · no line 2' };
      if (!parsed || !('syllable' in parsed)) return { error: 'not a syllable — sleep- · -ing · 2: Am' };
      return { intent: { type: 'setSyllable', line: parsed.line, text: parsed.syllable, ...(parsed.syllableType ? { syllableType: parsed.syllableType } : {}) } };
    }
    // Verse-line metadata typed at the wrong rung signposts the rung that
    // owns it (item 4's pattern) — the arm itself lives at the document rung.
    if (head === 'line' || (head === 'no' && /^line\b/i.test(rest)))
      return { error: 'a document thing — widen to the document rung: line 2 Nederlands nl · no line 2' };
    if (head === 'string' || head === 'fret') {
      const fb = context?.fingerboard;
      if (!fb) return { error: 'this part declares no strings — nothing to fret' };
      if (!context?.pitch) return { error: 'no note under the cursor' };
      const n = /^\d+$/.test(rest) ? Number(rest) : NaN;
      if (head === 'string') {
        if (!fb.tuning.some(t => t.string === n))
          return { error: `not a string — 1 to ${fb.tuning.length}` };
        // Unchanged is a no-op, chosen or derived: the guess is not frozen.
        if (n === fb.string) return { error: `already on string ${n}` };
        const fret = fretOn(fb, n, context.pitch as MnxNote['pitch']);
        if (fret === null) return { error: `${pitchText(context.pitch)} is not playable on string ${n}` };
        return { intent: { type: 'setStringAnnotation', string: n } };
      }
      if (!Number.isInteger(n) || n > MAX_FRET) return { error: `not a fret — 0 to ${MAX_FRET}` };
      if (n === fb.fret) return { error: `already at fret ${n}` };
      return { intent: { type: 'enterFret', fret: n } };
    }
    // Case-insensitively: `head` is lowercased above, and the camelCase
    // words (`hammerPull`, `palmMute`) never matched themselves — found
    // hands-on 2026-08-30, latent since the words list was born.
    const techniqueKind = TECHNIQUE_WORDS.find(k => k.toLowerCase() === head);
    if (techniqueKind === 'slide' && ['', 'shift', 'legato'].includes(rest))
      return { intent: { type: 'setTechnique', technique: { kind: 'slide', ...(rest === 'shift' ? { slideType: 'shift' } : rest === 'legato' ? { slideType: 'legato' } : {}) } as TechniqueChoice } };
    if (techniqueKind && techniqueKind !== 'bend' && rest === '')
      return { intent: { type: 'setTechnique', technique: { kind: techniqueKind } as TechniqueChoice } };
    if (head === 'bend') {
      // The stops, with a spelt-back `≈` tolerated: amending an approximated
      // pill regularises the curve, which is what the mark warns.
      const parsed = parseBendStops(rest.replace(/^≈/, ''));
      if ('error' in parsed) return { error: parsed.error };
      return { intent: { type: 'setTechnique', technique: { kind: 'bend', ...parsed } } };
    }
    // Container construction is a DECLARATION, not a verb: the typed text
    // carries its own extent (`wrapExtent`), the rhythm popover's founding
    // argument, so the wrap belongs to the slot like any other attribute.
    const rhythmish = /^\d+\s*[:\d]/.test(line) || ['tuplet', 'grace', 'appoggiatura', 'acciaccatura', 'tremolo', 'space', 'rest'].includes(head);
    if (rhythmish) {
      const declared = parseRhythm(head === 'tuplet' ? (rest || line) : line);
      if (declared && 'wrap' in declared)
        return { intent: { type: 'wrapInContainer', spec: declared.wrap, ...(declared.count === undefined ? {} : { count: declared.count }) } };
      if (declared && ('space' in declared || 'rest' in declared))
        return { error: 'a voice-bar thing — tighten to the voice rung: space 1/4 · rest half' };
      return { error: `not a rhythm declaration — ${RHYTHM_HELP}` };
    }
    // Container properties: the session resolves WHICH container from the
    // coincidence, so the parse stays address-free.
    if (head === 'bracket') {
      if (!['yes', 'no', 'auto'].includes(rest)) return { error: 'bracket is yes · no · auto' };
      return { intent: { type: 'setContainerProperties', properties: { bracket: rest as 'yes' | 'no' | 'auto' } } };
    }
    if (head === 'number') {
      const showNumber = rest === 'none' ? 'noNumber' : rest;
      if (!['noNumber', 'inner', 'both'].includes(showNumber)) return { error: 'number is inner · both · none' };
      return { intent: { type: 'setContainerProperties', properties: { showNumber: showNumber as 'noNumber' | 'inner' | 'both' } } };
    }
    if (head === 'slash') {
      if (!['yes', 'no', 'on', 'off'].includes(rest)) return { error: 'slash is yes · no' };
      return { intent: { type: 'setContainerProperties', properties: { slash: rest === 'yes' || rest === 'on' } } };
    }
    if (head === 'marks') {
      const n = Number(rest);
      if (!Number.isInteger(n) || n < 1 || n > 8) return { error: 'marks takes a small count — 2 · 3' };
      return { intent: { type: 'setContainerProperties', properties: { marks: n } } };
    }
    // The pills' words are nouns; the grammar's are bare values (`mf`,
    // `left 3`). Strip the noun so an amend composes what the grammar takes.
    if (head === 'fingering' || head === 'finger')
      return parseAdornmentLine(/^(left|right)\b/.test(rest) ? rest : `finger ${rest}`, word !== null);
    if (head === 'dynamic') return parseAdornmentLine(rest, word !== null);
    return parseAdornmentLine(line, word !== null);
  }
  if (level === 'voiceMeasure') {
    const parsed = parseBarAttribute(line);
    if (parsed && 'rhythm' in parsed) {
      if (parsed.rhythm === 'fullMeasureRest')
        return { intent: parsed.remove ? { type: 'removeFullMeasureRest' } : { type: 'setFullMeasureRest', ...(parsed.visualDuration ? { visualDuration: parsed.visualDuration } : {}) } };
      return { intent: parsed.remove ? { type: 'removeMeasureRepeat' } : { type: 'setMeasureRepeat', number: parsed.number ?? 1, ...(parsed.counter ? { counter: parsed.counter } : {}) } };
    }
    if (head === 'voice' && rest === '')
      return { intent: { type: 'addVoiceMeasure' } };
    // Authored silence and rest spelling (the rhythm popover's voice-bar
    // half): a point insertion and a respelling, both at the cursor.
    const declared = parseRhythm(line);
    if (declared && 'space' in declared)
      return { intent: { type: 'insertSpace', duration: declared.space } };
    if (declared && 'rest' in declared)
      return { intent: { type: 'setRestSpelling', duration: declared.rest } };
    if (declared && 'wrap' in declared)
      return { error: 'an event thing — tighten to the event rung to wrap a run' };
    return { error: 'not a rhythm declaration — full-measure rest · measure repeat 2 · space 1/4 · rest half' };
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
    if (head === 'tuning') {
      const tuning = parseTuning(rest);
      if (!tuning) return { error: 'not a tuning — standard · drop-d · pitches low→high like D2 A2 D3 G3 A3 D4' };
      return { intent: { type: 'setTuning', tuning } };
    }
    if (head === 'voice' && rest === '')
      return { intent: { type: 'addVoiceMeasure' } };
    if (head === 'name') {
      if (!rest) return { error: 'name takes the part’s name — `no name` makes it anonymous' };
      return { intent: { type: 'setPartDeclaration', declaration: { kind: 'name', value: rest } } };
    }
    if (line.toLowerCase().startsWith('staff kind')) {
      const kind = line.slice('staff kind'.length).trim().toLowerCase();
      if (kind !== 'tab' && kind !== 'notation' && kind !== 'both') return { error: 'staff kind is tab · notation · both' };
      return { intent: { type: 'setStaffKind', kind } };
    }
    // `staves 2`, `no capo`, `no name` … — the part popover's own arms; a
    // support flag typed here signposts the rung that owns it (item 4's
    // pattern).
    const declaration = parsePartDeclaration(line);
    if (declaration && 'set' in declaration)
      return { intent: { type: 'setPartDeclaration', declaration: declaration.set } };
    if (declaration && 'remove' in declaration)
      return { intent: { type: 'removePartDeclaration', kind: declaration.remove } };
    if (declaration && 'support' in declaration)
      return { error: 'a document thing — widen to the document rung: explicit accidentals · explicit beams' };
    return { error: 'not a part declaration — name · staves · staff kind · clef · capo · tuning' };
  }
  if (level === 'document') {
    const sentence = parseLayoutSentence(line);
    if (sentence) {
      if ('layout' in sentence) {
        const ids = context?.layoutIds ?? [];
        const existing = sentence.layout.id !== undefined ? ids.indexOf(sentence.layout.id) : -1;
        const index = existing >= 0 ? existing : Number.isNaN(sentence.layout.index) ? ids.length : sentence.layout.index;
        return { intent: { type: 'setLayout', index, layout: { id: sentence.layout.id, content: sentence.layout.content } } };
      }
      if ('score' in sentence) {
        const names = context?.scoreNames ?? [];
        const existing = sentence.score.value.name !== undefined ? names.indexOf(sentence.score.value.name) : -1;
        const index = existing >= 0 ? existing : Number.isNaN(sentence.score.index) ? names.length : sentence.score.index;
        return { intent: { type: 'setScore', index, score: sentence.score.value } };
      }
      if ('multimeasureRest' in sentence)
        return { intent: { type: 'addMultimeasureRest', ...sentence.multimeasureRest } };
      return {
        intent:
          sentence.removeDocument === 'layout'
            ? { type: 'removeLayout', index: sentence.index }
            : sentence.removeDocument === 'score'
              ? { type: 'removeScore', index: sentence.index }
              : { type: 'removeMultimeasureRest', scoreIndex: 0, index: sentence.index }
      };
    }
    const declaration = parsePartDeclaration(line);
    if (declaration && 'support' in declaration)
      return { intent: { type: 'setSupport', key: declaration.support.key, value: declaration.support.value } };
    if (head === 'part') {
      // parsePart never fails: an empty rest is the anonymous part MNX allows.
      const named = parsePart(rest);
      return { intent: { type: 'addPart', ...(named.partId !== undefined ? { partId: named.partId } : {}), ...(named.name !== undefined ? { name: named.name } : {}) } };
    }
    // Verse-line metadata (one-surface item 6): `line 2 Nederlands nl` and
    // `no line 2` through parseLyric's own arms — a pill amend composes the
    // same way (`line 2` + the typed rest).
    if (head === 'line' || (head === 'no' && /^line\b/i.test(rest))) {
      const parsed = parseLyric(line);
      if (parsed && 'removeLine' in parsed) return { intent: { type: 'removeLyricLine', line: parsed.removeLine } };
      if (parsed && 'line' in parsed && !('syllable' in parsed))
        return {
          intent: {
            type: 'setLyricLine',
            line: parsed.line,
            ...(parsed.label !== undefined ? { label: parsed.label } : {}),
            ...(parsed.lang !== undefined ? { lang: parsed.lang } : {})
          }
        };
      return { error: 'not a verse line — line 2 Nederlands nl · no line 2' };
    }
    return { error: 'not a document declaration — part <name> · layout L1: bracket [ vn1, vn2 ] · score "A": layout L1 · mmrest m3 x2 · line 2 Nederlands nl · explicit accidentals' };
  }
  return { error: rungNote(level) ?? 'nothing to set at this rung' };
}
