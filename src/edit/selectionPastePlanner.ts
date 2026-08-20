// Pure clipboard paste planning under the landing invariant
// (roadmap: core-paste-lands.md): **a decodable clip always lands.**
//
// Paste is a write with a well-defined footprint, not a negotiation: the
// clip defines what and how much, the anchor defines where, and the document
// yields — overwriting exactly the footprint (rule 2), consuming partially
// covered units whole with rests filling the remainder (rule 3), and
// extending the timeline or the part list rather than clipping (rule 4).
// The destination selection contributes only an anchor (rule 1); its rung
// gates nothing and its extent is ignored. Questionable results land and
// are FLAGGED by the forgiving renderer's diagnostics — never refused.
// Every yielding move is counted in the plan's accommodation record, which
// is the notice the author reads before deciding whether to undo.
//
// The planner builds a complete detached next document. It never mutates
// the supplied score, reads a clipboard, or writes editor history;
// selectionClipboardActions/session commit an accepted plan atomically at
// the environment/history boundary.
import type {
  MnxBeam,
  MnxEvent,
  MnxGlobalMeasure,
  MnxLayoutContent,
  MnxNote,
  MnxOttava,
  MnxPart,
  MnxPartMeasure,
  MnxSequence,
  MnxSequenceItem,
  MnxStructure
} from '../model/mnx.ts';
import { isTimedEvent } from '../model/mnx.ts';
import {
  addOnsets,
  itemSpan,
  measureSpans,
  onsetsEqual,
  type Onset,
  type Projection
} from './cursor.ts';
import {
  resolveSelection,
  type SelectionMember,
  type SelectionState
} from './selection.ts';
import {
  MNX_LAB_EXTENSION_VERSION,
  SelectionClipDecodeError,
  decodeSelectionClip,
  type ClipBarRelationships,
  type SelectionClipDependencies,
  type SelectionClipEnvelope
} from './selectionClip.ts';
import { midiOfPitch } from './tabStrings.ts';
import {
  pruneDanglingSelectionReferences,
  replaceSelectionStaffMaterial,
  restItemsForDuration
} from './selectionStructuralEdit.ts';

/** The surviving refusals are the decode tier only — cases with nothing to
 *  land. Every destination-shape mismatch is an accommodation now. */
export type PasteRefusalCode =
  | 'invalid-clip'
  | 'unsupported-version'
  | 'invalid-payload';

export interface PasteRefusal {
  ok: false;
  code: PasteRefusalCode;
  message: string;
}

/** What the document yielded to let the clip land — the counted record of
 *  rules 3 and 4, plus the land-and-flag counts. Reported, never silent. */
export interface PasteAccommodations {
  /** Bars appended to the global timeline (empty copies in every part). */
  appendedBars: number;
  /** Parts created from a measures/section clip's part descriptors. */
  createdParts: number;
  /** Sequences created where the anchor voice did not exist (D4). */
  createdSequences: number;
  /** Rest/space items inserted where a consumed unit outlived the footprint. */
  restFills: number;
  /** Annotated notes landed for the tab diagnostics layer to flag. */
  flaggedNotes: number;
  /** Surplus note-set members with no notehead left to land on. */
  droppedMembers: number;
  /** A score clip replaced the whole document (D5). */
  replacedDocument: boolean;
}

function emptyAccommodations(): PasteAccommodations {
  return {
    appendedBars: 0,
    createdParts: 0,
    createdSequences: 0,
    restFills: 0,
    flaggedNotes: 0,
    droppedMembers: 0,
    replacedDocument: false
  };
}

export interface PasteIdMap {
  notes: Record<string, string>;
  events: Record<string, string>;
  measures: Record<string, string>;
  parts: Record<string, string>;
  layouts: Record<string, string>;
}

export interface PasteLanding {
  level: SelectionState['level'];
  partIndex: number;
  staffIndex: number;
  voiceIndex: number;
  measureStart: number;
  measureEnd: number;
  /** Exact metric edges of the pasted material. Bar-and-above rungs use the
   *  start of their edge bars; event/container ranges retain their real
   *  onsets so Stage 4 can select the whole result without re-reading the
   *  source clip. */
  onsetStart: [number, number];
  onsetEnd: [number, number];
  /** Structural clips land as their natural live closure: a copied part is
   *  the new part, and a copied score is the whole score. */
  closure?: 'part' | 'score';
}

export interface PastePlan {
  ok: true;
  clipKind: SelectionClipEnvelope['clip']['kind'];
  /** Complete atomic result, detached from both source clip and destination. */
  document: MnxStructure;
  idMap: PasteIdMap;
  landing: PasteLanding;
  dependencyMerge?: SelectionClipDependencies;
  detachedTargetReferences: number;
  accommodations: PasteAccommodations;
}

export type PastePlanResult = PastePlan | PasteRefusal;

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function refuse(code: PasteRefusalCode, message: string): PasteRefusal {
  return { ok: false, code, message };
}

function sameSelectionCursor(state: SelectionState): boolean {
  if (state.extent.kind !== 'cursor') return false;
  const a = state.anchor;
  const b = state.extent.cursor;
  return (
    a.measureIndex === b.measureIndex &&
    onsetsEqual(a.onset, b.onset) &&
    a.line === b.line &&
    a.slotIndex === b.slotIndex &&
    a.eventSlotIndex === b.eventSlotIndex &&
    (a.partIndex ?? 0) === (b.partIndex ?? 0) &&
    (a.staffIndex ?? 1) === (b.staffIndex ?? 1) &&
    (a.voiceIndex ?? 0) === (b.voiceIndex ?? 0)
  );
}

function addSpan(items: MnxSequenceItem[]): Onset {
  return items.reduce((span, item) => addOnsets(span, itemSpan(item)), { num: 0, den: 1 });
}

function compareSpan(a: Onset, b: Onset): number {
  return a.num * b.den - b.num * a.den;
}

function visitItems(items: MnxSequenceItem[], visit: (event: MnxEvent) => void): void {
  for (const item of items) {
    if (isTimedEvent(item)) visit(item);
    else visitItems((item as { content?: MnxSequenceItem[] }).content ?? [], visit);
  }
}

function notesInItems(items: MnxSequenceItem[]): MnxNote[] {
  const notes: MnxNote[] = [];
  visitItems(items, event => notes.push(...(event.notes ?? [])));
  return notes;
}

function notesInMeasure(measure: MnxPartMeasure): MnxNote[] {
  return measure.sequences.flatMap(sequence => notesInItems(sequence.content));
}

function allNotes(doc: MnxStructure): MnxNote[] {
  return doc.parts.flatMap(part => part.measures.flatMap(notesInMeasure));
}

function allEvents(doc: MnxStructure): MnxEvent[] {
  const events: MnxEvent[] = [];
  doc.parts.forEach(part => part.measures.forEach(measure =>
    measure.sequences.forEach(sequence => visitItems(sequence.content, event => events.push(event)))
  ));
  return events;
}

function sequenceIndexAt(
  doc: MnxStructure,
  partIndex: number,
  staffIndex: number,
  measureIndex: number,
  voiceIndex: number
): number | undefined {
  return (doc.parts?.[partIndex]?.measures?.[measureIndex]?.sequences ?? [])
    .map((sequence, index) => ({ sequence, index }))
    .filter(entry => (entry.sequence.staff ?? 1) === staffIndex)[voiceIndex]?.index;
}

function validateEnvelopePayload(envelope: SelectionClipEnvelope): PasteRefusal | null {
  const clip = envelope.clip;
  switch (clip.kind) {
    case 'note-set':
      if (clip.notes.length === 0 || clip.notes.some(note =>
        !note.pitch || !'CDEFGAB'.includes(note.pitch.step) || !Number.isInteger(note.pitch.octave)
      )) return refuse('invalid-payload', 'The note clip has no valid pitched notes.');
      break;
    case 'event-run':
      if (clip.span < 1 || clip.bars.length === 0 || clip.bars.some(bar =>
        bar.offset < 0 || bar.offset >= clip.span || bar.items.length === 0
      )) return refuse('invalid-payload', 'The event clip has invalid bar runs.');
      break;
    case 'container-run':
      if (clip.span < 1 || clip.bars.length === 0 || clip.bars.some(bar =>
        bar.offset < 0 || bar.offset >= clip.span || bar.containers.length === 0 ||
        bar.containers.some(container => !['tuplet', 'grace', 'tremolo'].includes(container.type))
      )) return refuse('invalid-payload', 'The container clip has invalid bar runs.');
      break;
    case 'voice-bars':
      if (clip.span < 1 || clip.bars.some(bar => bar.offset < 0 || bar.offset >= clip.span))
        return refuse('invalid-payload', 'The voice clip has invalid bar offsets.');
      break;
    case 'staff-bars':
      if (clip.span < 1 || clip.bars.some(bar => bar.offset < 0 || bar.offset >= clip.span))
        return refuse('invalid-payload', 'The staff clip has invalid bar offsets.');
      break;
    case 'part':
      if (!Array.isArray(clip.part.measures)) return refuse('invalid-payload', 'The part clip has no measures.');
      break;
    case 'measures':
      if (clip.measures.length === 0 || clip.measures.some(column => column.parts.length !== clip.parts.length))
        return refuse('invalid-payload', 'The measure clip has inconsistent part columns.');
      break;
    case 'section':
      if (clip.sections.length === 0 || clip.sections.some(section =>
        section.measures.length === 0 || section.measures.some(column => column.parts.length !== clip.parts.length)
      )) return refuse('invalid-payload', 'The section clip has inconsistent measure columns.');
      break;
    case 'score':
      if (!clip.score.mnx || !clip.score.global || !Array.isArray(clip.score.parts))
        return refuse('invalid-payload', 'The score clip is not an MNX structure.');
      break;
  }
  return null;
}

type IdKind = keyof PasteIdMap;

class IdAllocator {
  readonly maps: PasteIdMap = { notes: {}, events: {}, measures: {}, parts: {}, layouts: {} };
  private readonly taken: Record<IdKind, Set<string>> = {
    notes: new Set(), events: new Set(), measures: new Set(), parts: new Set(), layouts: new Set()
  };
  private readonly freshCounters: Record<IdKind, number> = {
    notes: 0, events: 0, measures: 0, parts: 0, layouts: 0
  };

  constructor(doc: MnxStructure) {
    allNotes(doc).forEach(note => { if (note.id) this.taken.notes.add(note.id); });
    allEvents(doc).forEach(event => { if (event.id) this.taken.events.add(event.id); });
    doc.parts.forEach(part => { if (part.id) this.taken.parts.add(part.id); });
    doc.global.measures.forEach(measure => { if (measure.id) this.taken.measures.add(measure.id); });
    (doc.layouts ?? []).forEach(layout => this.taken.layouts.add(layout.id));
  }

  bind(kind: IdKind, source: string, target: string): void {
    this.maps[kind][source] = target;
    this.taken[kind].add(target);
  }

  map(kind: IdKind, source: string): string {
    const existing = this.maps[kind][source];
    if (existing) return existing;
    const prefix: Record<IdKind, string> = {
      notes: 't', events: 'ev', measures: 'm', parts: 'p', layouts: 'layout'
    };
    for (let index = 1; ; index++) {
      const candidate = `${prefix[kind]}${index}`;
      if (candidate !== source && !this.taken[kind].has(candidate)) {
        this.maps[kind][source] = candidate;
        this.taken[kind].add(candidate);
        return candidate;
      }
    }
  }

  fresh(kind: IdKind): string {
    const prefix: Record<IdKind, string> = {
      notes: 't', events: 'ev', measures: 'm', parts: 'p', layouts: 'layout'
    };
    for (let index = this.freshCounters[kind] + 1; ; index++) {
      const candidate = `${prefix[kind]}${index}`;
      if (!this.taken[kind].has(candidate)) {
        this.freshCounters[kind] = index;
        this.taken[kind].add(candidate);
        return candidate;
      }
    }
  }
}

function rewriteNote(note: MnxNote, ids: IdAllocator): void {
  if (note.id) note.id = ids.map('notes', note.id);
  note.ties?.forEach(tie => { if (tie.target) tie.target = ids.map('notes', tie.target); });
  const technique = note._x?.mnxLab?.tab?.technique as
    | Record<string, { target?: string } | boolean | undefined>
    | undefined;
  Object.values(technique ?? {}).forEach(value => {
    if (value && typeof value === 'object' && value.target)
      value.target = ids.map('notes', value.target);
  });
}

function rewriteEvent(event: MnxEvent, ids: IdAllocator): void {
  if (event.id) event.id = ids.map('events', event.id);
  event.notes?.forEach(note => rewriteNote(note, ids));
  event.slurs?.forEach(slur => {
    slur.target = ids.map('events', slur.target);
    if (slur.startNote) slur.startNote = ids.map('notes', slur.startNote);
    if (slur.endNote) slur.endNote = ids.map('notes', slur.endNote);
  });
}

function rewriteItems(items: MnxSequenceItem[], ids: IdAllocator): void {
  for (const item of items) {
    if (isTimedEvent(item)) rewriteEvent(item, ids);
    else {
      const container = item as { id?: string; content?: MnxEvent[] };
      if (container.id) container.id = ids.map('events', container.id);
      container.content?.forEach(event => rewriteEvent(event, ids));
    }
  }
}

function rewriteBeam(beam: MnxBeam, ids: IdAllocator): void {
  beam.events = beam.events.map(id => ids.map('events', id));
  beam.beams?.forEach(child => rewriteBeam(child, ids));
}

function rewriteOttava(ottava: MnxOttava, ids: IdAllocator): void {
  ottava.end.measure = ids.map('measures', ottava.end.measure);
}

function rewriteMeasure(measure: MnxPartMeasure, ids: IdAllocator): void {
  measure.sequences.forEach(sequence => rewriteItems(sequence.content, ids));
  measure.beams?.forEach(beam => rewriteBeam(beam, ids));
  measure.ottavas?.forEach(ottava => rewriteOttava(ottava, ids));
}

function rewritePart(part: MnxPart, ids: IdAllocator): void {
  if (part.id) part.id = ids.map('parts', part.id);
  part.measures.forEach(measure => rewriteMeasure(measure, ids));
}

function rewriteLayoutContent(content: MnxLayoutContent[], ids: IdAllocator): void {
  content.forEach(node => {
    node.sources?.forEach(source => { source.part = ids.map('parts', source.part); });
    if (node.content) rewriteLayoutContent(node.content, ids);
  });
}

function rewriteWholeScore(score: MnxStructure, ids: IdAllocator): void {
  score.global.measures.forEach(measure => { if (measure.id) measure.id = ids.map('measures', measure.id); });
  score.parts.forEach(part => rewritePart(part, ids));
  score.layouts?.forEach(layout => {
    layout.id = ids.map('layouts', layout.id);
    rewriteLayoutContent(layout.content, ids);
  });
  score.scores?.forEach(presentation => {
    if (presentation.layout) presentation.layout = ids.map('layouts', presentation.layout);
    presentation.pages?.forEach(page => page.systems?.forEach(system => {
      system.measure = ids.map('measures', system.measure);
      if (system.layout) system.layout = ids.map('layouts', system.layout);
    }));
    presentation.multimeasureRests?.forEach(rest => {
      rest.start = ids.map('measures', rest.start);
    });
  });
}

function targetMeasureId(after: MnxStructure, index: number, ids: IdAllocator): string {
  const measure = after.global.measures[index];
  if (!measure.id) measure.id = ids.fresh('measures');
  return measure.id;
}

function bindContextMeasures(
  envelope: SelectionClipEnvelope,
  after: MnxStructure,
  targetStart: number,
  ids: IdAllocator
): void {
  (envelope.context?.measures ?? []).forEach((context, offset) => {
    if (context.id && after.global.measures[targetStart + offset])
      ids.bind('measures', context.id, targetMeasureId(after, targetStart + offset, ids));
  });
}

function rewriteRelationships(
  relationships: ClipBarRelationships[] | undefined,
  ids: IdAllocator
): ClipBarRelationships[] | undefined {
  if (!relationships) return undefined;
  const rewritten = cloneJson(relationships);
  rewritten.forEach(measure => {
    measure.beams?.forEach(beam => rewriteBeam(beam, ids));
    measure.ottavas?.forEach(ottava => rewriteOttava(ottava, ids));
  });
  return rewritten;
}

function mergedDependencies(
  target: MnxStructure,
  dependencies: SelectionClipDependencies | undefined
): SelectionClipDependencies | undefined {
  if (!dependencies) return undefined;
  const support = dependencies.support || target.mnx.support
    ? { ...(dependencies.support ?? {}), ...(target.mnx.support ?? {}) }
    : undefined;
  const sourceLyrics = dependencies.lyrics;
  const targetLyrics = target.global.lyrics;
  const lineOrder = [...new Set([
    ...(targetLyrics?.lineOrder ?? []),
    ...(sourceLyrics?.lineOrder ?? [])
  ])];
  const lineMetadata = {
    ...(sourceLyrics?.lineMetadata ?? {}),
    ...(targetLyrics?.lineMetadata ?? {})
  };
  const lyrics = sourceLyrics || targetLyrics
    ? {
        ...(lineOrder.length ? { lineOrder } : {}),
        ...(Object.keys(lineMetadata).length ? { lineMetadata } : {})
      }
    : undefined;
  return support || lyrics
    ? { ...(support ? { support } : {}), ...(lyrics ? { lyrics } : {}) }
    : undefined;
}

function applyDependencies(doc: MnxStructure, merged: SelectionClipDependencies | undefined): void {
  if (!merged) return;
  if (merged.support) doc.mnx.support = cloneJson(merged.support);
  if (merged.lyrics) doc.global.lyrics = cloneJson(merged.lyrics);
}

/** Land-and-flag (core-paste-lands.md): annotated notes that cannot sound on
 *  the destination instrument land anyway — the renderer's red `scope:'tab'`
 *  badges already say so per note. This only COUNTS them for the record. */
function countUnplayableAnnotations(notes: MnxNote[], part: MnxPart | undefined): number {
  const annotated = notes.filter(note => note._x?.mnxLab?.string !== undefined);
  if (annotated.length === 0) return 0;
  const strings = part?._x?.mnxLab?.strings;
  if (!strings?.length) return annotated.length;
  const capo = part?._x?.mnxLab?.capo ?? 0;
  return annotated.filter(note => {
    const number = note._x!.mnxLab!.string!;
    const string = strings.find(entry => entry.string === number);
    if (!string) return true;
    const fret = midiOfPitch(note.pitch) - (midiOfPitch(string.pitch) + capo);
    return fret < 0 || fret > 24 ||
      (note._x!.mnxLab!.fret !== undefined && note._x!.mnxLab!.fret !== fret);
  }).length;
}

function emptyPartMeasure(measure: MnxPartMeasure): boolean {
  return Object.keys(measure).every(key => key === 'sequences') &&
    measure.sequences.every(sequence => sequence.content.length === 0 && Object.keys(sequence).every(
      key => key === 'content' || key === 'staff'
    ));
}

function emptyPart(part: MnxPart): boolean {
  return Object.keys(part).every(key => key === 'measures') && part.measures.every(emptyPartMeasure);
}

function emptyGlobalMeasure(measure: MnxGlobalMeasure): boolean {
  return Object.keys(measure).length === 0;
}

function isEmptyDocument(doc: MnxStructure): boolean {
  return !doc.layouts?.length && !doc.scores?.length && !doc.global.lyrics &&
    !doc.mnx.support && doc.global.measures.every(emptyGlobalMeasure) &&
    (doc.parts.length === 0 || (doc.parts.length === 1 && emptyPart(doc.parts[0])));
}

interface EventUnit {
  measureIndex: number;
  sequenceIndex: number;
  itemIndex: number;
  item: MnxSequenceItem;
  onset: Onset;
}

function activeVoiceUnits(doc: MnxStructure, state: SelectionState): EventUnit[] {
  const partIndex = state.anchor.partIndex ?? 0;
  const staffIndex = state.anchor.staffIndex ?? 1;
  const voiceIndex = state.anchor.voiceIndex ?? 0;
  const units: EventUnit[] = [];
  (doc.parts?.[partIndex]?.measures ?? []).forEach((measure, measureIndex) => {
    const sequenceIndex = sequenceIndexAt(doc, partIndex, staffIndex, measureIndex, voiceIndex);
    if (sequenceIndex === undefined) return;
    let onset: Onset = { num: 0, den: 1 };
    measure.sequences[sequenceIndex].content.forEach((item, itemIndex) => {
      units.push({ measureIndex, sequenceIndex, itemIndex, item, onset });
      onset = addOnsets(onset, itemSpan(item));
    });
  });
  return units;
}

function emptyPartBar(): MnxPartMeasure {
  return { sequences: [] };
}

/** Rule 4: the timeline extends rather than clipping the clip. Appends empty
 *  global bars through `lastIndex` and pads every part to timeline length. */
function ensureBars(after: MnxStructure, lastIndex: number, acc: PasteAccommodations): void {
  while (after.global.measures.length <= lastIndex) {
    after.global.measures.push({});
    acc.appendedBars++;
  }
  after.parts.forEach(part => {
    while (part.measures.length < after.global.measures.length) part.measures.push(emptyPartBar());
  });
}

/** D4 — the narrow sequence-creation policy paste cannot defer: where the
 *  anchor voice has no sequence, create one holding exactly the pasted
 *  content. No intermediate empty voices are fabricated; the created
 *  sequence is simply the staff's next voice, and its index is returned. */
function ensureSequenceIndex(
  after: MnxStructure,
  partIndex: number,
  staffIndex: number,
  measureIndex: number,
  voiceIndex: number,
  acc: PasteAccommodations
): number {
  const existing = sequenceIndexAt(after, partIndex, staffIndex, measureIndex, voiceIndex);
  if (existing !== undefined) return existing;
  const measure = after.parts[partIndex].measures[measureIndex];
  const sequence: MnxSequence = {
    content: [],
    ...(staffIndex === 1 ? {} : { staff: staffIndex })
  };
  measure.sequences.push(sequence);
  acc.createdSequences++;
  return measure.sequences.length - 1;
}

function subtractOnsets(a: Onset, b: Onset): Onset {
  return addOnsets(a, { num: -b.num, den: b.den });
}

/**
 * Rules 2 and 3 in one move: overwrite the interval `[start, start+span)` of
 * one voice's bar content with `replacement`. Items partially covered by the
 * footprint's edges are consumed WHOLE (a tuplet cannot be split), and the
 * uncovered remainders — before the footprint where consumption began early,
 * after it where the last consumed unit outlived it — fill with rests via
 * the shared spelling. Content ending before `start` is padded so the
 * pasted material sits at its true onset. A zero-span replacement (a grace
 * clip) inserts without consuming. Zero-width items at the footprint's
 * start are consumed; at its end they are kept (half-open, like the rule).
 */
function overwriteVoiceInterval(
  content: MnxSequenceItem[],
  start: Onset,
  replacement: MnxSequenceItem[],
  acc: PasteAccommodations
): MnxSequenceItem[] {
  const span = addSpan(replacement);
  if (span.num === 0) {
    let onset: Onset = { num: 0, den: 1 };
    let index = 0;
    for (; index < content.length; index++) {
      const itemEnd = addOnsets(onset, itemSpan(content[index]));
      // Stop at the first item the insertion point does not lie strictly
      // beyond: its own onset reaches start, or it covers start.
      if (compareSpan(onset, start) >= 0 || compareSpan(itemEnd, start) > 0) break;
      onset = itemEnd;
    }
    const pad = index === content.length && compareSpan(onset, start) < 0
      ? restItemsForDuration(...onsetPair(subtractOnsets(start, onset)))
      : [];
    acc.restFills += pad.length;
    return [...content.slice(0, index), ...pad, ...replacement, ...content.slice(index)];
  }

  const end = addOnsets(start, span);
  const before: MnxSequenceItem[] = [];
  const tail: MnxSequenceItem[] = [];
  let consumedStart: Onset | null = null;
  let consumedEnd: Onset | null = null;
  let onset: Onset = { num: 0, den: 1 };
  for (const item of content) {
    const width = itemSpan(item);
    const itemEnd = addOnsets(onset, width);
    const zeroWidth = width.num === 0;
    const isBefore = zeroWidth
      ? compareSpan(onset, start) < 0
      : compareSpan(itemEnd, start) <= 0;
    const isAfter = compareSpan(onset, end) >= 0;
    if (isBefore) before.push(item);
    else if (isAfter) tail.push(item);
    else {
      if (consumedStart === null) consumedStart = onset;
      consumedEnd = itemEnd;
    }
    onset = itemEnd;
  }
  const contentEnd = onset;
  const leadGap = consumedStart !== null
    ? subtractOnsets(start, consumedStart)
    : compareSpan(contentEnd, start) < 0
      ? subtractOnsets(start, contentEnd)
      : { num: 0, den: 1 };
  const trailGap = consumedEnd !== null && compareSpan(consumedEnd, end) > 0
    ? subtractOnsets(consumedEnd, end)
    : { num: 0, den: 1 };
  const leadFill = leadGap.num > 0 ? restItemsForDuration(...onsetPair(leadGap)) : [];
  const trailFill = trailGap.num > 0 ? restItemsForDuration(...onsetPair(trailGap)) : [];
  acc.restFills += leadFill.length + trailFill.length;
  return [...before, ...leadFill, ...replacement, ...trailFill, ...tail];
}

function onsetPair(onset: Onset): [number, number] {
  return [onset.num, onset.den];
}

/** Rule 1's bar anchor: the selection's FIRST bar, whatever its shape. */
function anchorBarStart(
  doc: MnxStructure,
  state: SelectionState,
  projection: Projection
): number {
  if (state.extent.kind === 'cursor' && !sameSelectionCursor(state)) {
    return Math.min(state.anchor.measureIndex, state.extent.cursor.measureIndex);
  }
  if (state.extent.kind === 'closure') {
    const measures = resolveSelection(doc, state, projection).members.flatMap(member =>
      member.kind === 'section'
        ? [member.start]
        : 'measureIndex' in member
          ? [member.measureIndex]
          : []
    );
    if (measures.length) return Math.min(...measures);
  }
  return state.anchor.measureIndex;
}

/** Rule 1's run anchor: the earliest resolved member's own onset at the run
 *  rungs (its address is exact), the raw cursor onset otherwise — rule 3
 *  makes a mid-item start safe either way. */
function runAnchor(
  doc: MnxStructure,
  state: SelectionState,
  projection: Projection
): { measureIndex: number; onset: Onset } {
  if (state.level === 'note' || state.level === 'event' || state.level === 'container') {
    const members = resolveSelection(doc, state, projection).members;
    let best: { measureIndex: number; onset: Onset } | null = null;
    for (const member of members) {
      if (!('onset' in member)) continue;
      if (
        best === null ||
        member.measureIndex < best.measureIndex ||
        (member.measureIndex === best.measureIndex && compareSpan(member.onset, best.onset) < 0)
      ) best = { measureIndex: member.measureIndex, onset: { ...member.onset } };
    }
    if (best) return best;
  }
  return { measureIndex: state.anchor.measureIndex, onset: { ...state.anchor.onset } };
}

function rewriteExistingMeasureReferences(doc: MnxStructure, mapping: Map<string, string>): void {
  if (!mapping.size) return;
  doc.parts.forEach(part => part.measures.forEach(measure => measure.ottavas?.forEach(ottava => {
    ottava.end.measure = mapping.get(ottava.end.measure) ?? ottava.end.measure;
  })));
  doc.scores?.forEach(score => {
    score.pages?.forEach(page => page.systems?.forEach(system => {
      system.measure = mapping.get(system.measure) ?? system.measure;
    }));
    score.multimeasureRests?.forEach(rest => {
      rest.start = mapping.get(rest.start) ?? rest.start;
    });
  });
}

function landing(
  state: SelectionState,
  level: SelectionState['level'],
  measureStart: number,
  measureEnd: number,
  onsetStart: Onset = { num: 0, den: 1 },
  onsetEnd: Onset = { num: 0, den: 1 }
): PasteLanding {
  return {
    level,
    partIndex: state.anchor.partIndex ?? 0,
    staffIndex: state.anchor.staffIndex ?? 1,
    voiceIndex: state.anchor.voiceIndex ?? 0,
    measureStart,
    measureEnd,
    onsetStart: [onsetStart.num, onsetStart.den],
    onsetEnd: [onsetEnd.num, onsetEnd.den]
  };
}

/** Decode and plan one paste without changing `destination`. */
export function planSelectionPaste(
  serialized: string,
  destination: MnxStructure,
  state: SelectionState,
  projection: Projection
): PastePlanResult {
  let envelope: SelectionClipEnvelope;
  try {
    envelope = decodeSelectionClip(serialized);
  } catch (error) {
    return refuse(
      error instanceof SelectionClipDecodeError ? 'invalid-clip' : 'invalid-payload',
      error instanceof Error ? error.message : 'The clipboard value is invalid.'
    );
  }
  if (
    envelope.source.mnxVersion !== destination.mnx.version ||
    envelope.source.extensionVersion !== MNX_LAB_EXTENSION_VERSION
  ) {
    return refuse('unsupported-version', 'Clipboard and destination MNX versions are not compatible.');
  }
  const payloadError = validateEnvelopePayload(envelope);
  if (payloadError) return payloadError;

  const after = cloneJson(destination);
  const ids = new IdAllocator(destination);
  const partIndex = state.anchor.partIndex ?? 0;
  const staffIndex = state.anchor.staffIndex ?? 1;
  const voiceIndex = state.anchor.voiceIndex ?? 0;
  const accommodations = emptyAccommodations();
  let resultLanding: PasteLanding;
  let merge = envelope.clip.kind === 'score'
    ? undefined
    : mergedDependencies(destination, envelope.dependencies);
  const clip = cloneJson(envelope.clip);

  switch (clip.kind) {
    case 'note-set': {
      accommodations.flaggedNotes += countUnplayableAnnotations(clip.notes, destination.parts[partIndex]);
      clip.notes.forEach(note => rewriteNote(note, ids));
      // The landing slots: every notehead of the anchor voice in timeline
      // order, plus rest events as one slot each — D6 inks a rest with the
      // rest's own duration (the clip has none to bring), D7 replaces the
      // resolved chord member when the anchor names one.
      interface NoteSlot {
        measureIndex: number;
        onset: Onset;
        event: MnxEvent;
        noteIndex: number | null;
        itemIndex: number;
        containerIndex?: number;
      }
      const slots: NoteSlot[] = [];
      activeVoiceUnits(after, state).forEach(unit => {
        const events: { event: MnxEvent; containerIndex?: number }[] = isTimedEvent(unit.item)
          ? [{ event: unit.item }]
          : ((unit.item as { content?: MnxEvent[] }).content ?? [])
              .map((event, containerIndex) => ({ event, containerIndex }));
        events.forEach(({ event, containerIndex }) => {
          if (event.notes?.length) {
            event.notes.forEach((_, noteIndex) => slots.push({
              measureIndex: unit.measureIndex, onset: unit.onset, event,
              noteIndex, itemIndex: unit.itemIndex,
              ...(containerIndex === undefined ? {} : { containerIndex })
            }));
          } else if (event.rest) {
            slots.push({
              measureIndex: unit.measureIndex, onset: unit.onset, event,
              noteIndex: null, itemIndex: unit.itemIndex,
              ...(containerIndex === undefined ? {} : { containerIndex })
            });
          }
        });
      });
      const anchor = runAnchor(destination, state, projection);
      const noteMember = state.level === 'note'
        ? resolveSelection(destination, state, projection).members.find(
            (member): member is Extract<SelectionMember, { kind: 'note' }> => member.kind === 'note'
          )
        : undefined;
      let startIndex = noteMember
        ? slots.findIndex(slot =>
            slot.measureIndex === noteMember.measureIndex &&
            slot.itemIndex === noteMember.eventIndex &&
            slot.containerIndex === noteMember.containerIndex &&
            slot.noteIndex === noteMember.noteIndex
          )
        : slots.findIndex(slot =>
            slot.measureIndex > anchor.measureIndex ||
            (slot.measureIndex === anchor.measureIndex && compareSpan(slot.onset, anchor.onset) >= 0)
          );
      if (startIndex < 0) startIndex = slots.length;
      const landed: NoteSlot[] = [];
      let clipIndex = 0;
      for (let index = startIndex; index < slots.length && clipIndex < clip.notes.length; index++) {
        const slot = slots[index];
        if (slot.noteIndex === null) {
          delete (slot.event as { rest?: object }).rest;
          slot.event.notes = [clip.notes[clipIndex++]];
        } else {
          slot.event.notes![slot.noteIndex] = clip.notes[clipIndex++];
        }
        landed.push(slot);
      }
      accommodations.droppedMembers += clip.notes.length - clipIndex;
      const first = landed[0];
      const last = landed[landed.length - 1];
      resultLanding = landing(
        state,
        'note',
        first?.measureIndex ?? anchor.measureIndex,
        last?.measureIndex ?? anchor.measureIndex,
        first?.onset ?? anchor.onset,
        last?.onset ?? anchor.onset
      );
      break;
    }
    case 'event-run':
    case 'container-run': {
      const level = clip.kind === 'event-run' ? 'event' as const : 'container' as const;
      const runBars = clip.kind === 'event-run'
        ? clip.bars.map(bar => ({ offset: bar.offset, onset: bar.onset, items: bar.items }))
        : clip.bars.map(bar => ({
            offset: bar.offset, onset: bar.onset,
            items: bar.containers as MnxSequenceItem[]
          }));
      accommodations.flaggedNotes += countUnplayableAnnotations(
        notesInItems(runBars.flatMap(bar => bar.items)),
        destination.parts[partIndex]
      );
      const anchor = runAnchor(destination, state, projection);
      runBars.forEach(bar => rewriteItems(bar.items, ids));

      // D8 — FLOW. Linearize the clip against its recorded source meters
      // (each item's distance from the run's first item, gaps included),
      // then re-bin every item against the DESTINATION's meters from the
      // anchor position: barlines fall where the destination says, whole
      // items crossing them simply land in the bar their onset falls in
      // (overfull is the diagnostics layer's to flag — D2 intact), and gaps
      // remain exactly the silent time they were, touching nothing.
      const sourceCapacity = (offset: number): Onset => {
        const effective = envelope.context?.measures?.[offset]?.effectiveTime;
        return effective ? { num: effective.count, den: effective.unit } : { num: 1, den: 1 };
      };
      const sourceBarStarts: Onset[] = [{ num: 0, den: 1 }];
      for (let offset = 1; offset < clip.span; offset++) {
        sourceBarStarts[offset] = addOnsets(sourceBarStarts[offset - 1], sourceCapacity(offset - 1));
      }
      interface FlowItem { item: MnxSequenceItem; stream: Onset }
      const stream: FlowItem[] = [];
      for (const bar of runBars) {
        let position = addOnsets(sourceBarStarts[bar.offset], { num: bar.onset[0], den: bar.onset[1] });
        for (const item of bar.items) {
          stream.push({ item, stream: position });
          position = addOnsets(position, itemSpan(item));
        }
      }
      const origin = stream[0]?.stream ?? { num: 0, den: 1 };

      const destinationSpans = measureSpans(after);
      const destinationCapacity = (index: number): Onset =>
        destinationSpans[index] ?? destinationSpans[destinationSpans.length - 1] ?? { num: 1, den: 1 };
      interface BinnedItem { item: MnxSequenceItem; measureIndex: number; onset: Onset }
      const binned: BinnedItem[] = stream.map(({ item, stream: at }) => {
        let measureIndex = anchor.measureIndex;
        let onset = addOnsets(anchor.onset, subtractOnsets(at, origin));
        for (;;) {
          const capacity = destinationCapacity(measureIndex);
          if (compareSpan(onset, capacity) < 0) break;
          onset = subtractOnsets(onset, capacity);
          measureIndex++;
        }
        return { item, measureIndex, onset };
      });
      const lastBinned = binned[binned.length - 1];
      ensureBars(after, lastBinned?.measureIndex ?? anchor.measureIndex, accommodations);
      bindContextMeasures(envelope, after, anchor.measureIndex, ids);

      // Contiguous items (next onset = previous end, same bar) overwrite as
      // one cluster, so a mid-stream gap makes no statement about the
      // destination material it skips.
      interface Cluster { measureIndex: number; start: Onset; items: MnxSequenceItem[]; end: Onset }
      const clusters: Cluster[] = [];
      for (const entry of binned) {
        const prior = clusters[clusters.length - 1];
        if (
          prior && prior.measureIndex === entry.measureIndex &&
          onsetsEqual(prior.end, entry.onset)
        ) {
          prior.items.push(entry.item);
          prior.end = addOnsets(prior.end, itemSpan(entry.item));
        } else {
          clusters.push({
            measureIndex: entry.measureIndex,
            start: entry.onset,
            items: [entry.item],
            end: addOnsets(entry.onset, itemSpan(entry.item))
          });
        }
      }
      for (const cluster of clusters) {
        const sequenceIndex = ensureSequenceIndex(
          after, partIndex, staffIndex, cluster.measureIndex, voiceIndex, accommodations
        );
        const sequence = after.parts[partIndex].measures[cluster.measureIndex].sequences[sequenceIndex];
        sequence.content = overwriteVoiceInterval(sequence.content, cluster.start, cluster.items, accommodations);
      }

      // Spanning relationships follow their music: a beam homes at the bar
      // its first event flowed into; ottavas keep the anchor-bar home their
      // measure references bind against.
      const relationships = rewriteRelationships(envelope.relationships?.measures, ids);
      const eventBar = new Map<string, number>();
      binned.forEach(entry => visitItems([entry.item], event => {
        if (event.id) eventBar.set(event.id, entry.measureIndex);
      }));
      relationships?.forEach(source => {
        source.beams?.forEach(beam => {
          const home = eventBar.get(beam.events[0]) ?? anchor.measureIndex + source.offset;
          const measure = after.parts[partIndex]?.measures?.[home];
          if (measure) measure.beams = [...(measure.beams ?? []), cloneJson(beam)];
        });
        if (source.ottavas?.length) {
          const measure = after.parts[partIndex]?.measures?.[anchor.measureIndex + source.offset];
          if (measure) measure.ottavas = [...(measure.ottavas ?? []), ...cloneJson(source.ottavas)];
        }
      });
      resultLanding = landing(
        state,
        level,
        anchor.measureIndex,
        lastBinned?.measureIndex ?? anchor.measureIndex,
        anchor.onset,
        lastBinned?.onset ?? anchor.onset
      );
      break;
    }
    case 'voice-bars': {
      const targetStart = anchorBarStart(destination, state, projection);
      ensureBars(after, targetStart + clip.span - 1, accommodations);
      accommodations.flaggedNotes += countUnplayableAnnotations(
        clip.bars.flatMap(bar => notesInItems(bar.sequence.content)),
        destination.parts[partIndex]
      );
      bindContextMeasures(envelope, after, targetStart, ids);
      clip.bars.forEach(bar => {
        rewriteItems(bar.sequence.content, ids);
        bar.declarations?.beams?.forEach(beam => rewriteBeam(beam, ids));
        bar.declarations?.ottavas?.forEach(ottava => rewriteOttava(ottava, ids));
      });
      for (let offset = 0; offset < clip.span; offset++) {
        const targetMeasure = after.parts[partIndex].measures[targetStart + offset];
        const targetSequenceIndex = sequenceIndexAt(after, partIndex, staffIndex, targetStart + offset, voiceIndex);
        const source = clip.bars.find(bar => bar.offset === offset);
        if (source) {
          const replacement = cloneJson(source.sequence);
          if (staffIndex === 1) delete replacement.staff;
          else replacement.staff = staffIndex;
          if (targetSequenceIndex === undefined) {
            // D4: the voice does not exist here — create it with exactly the
            // pasted content, keeping the clip's own voice label.
            targetMeasure.sequences.push(replacement);
            accommodations.createdSequences++;
          } else {
            const priorVoice = targetMeasure.sequences[targetSequenceIndex].voice;
            if (priorVoice === undefined) delete replacement.voice;
            else replacement.voice = priorVoice;
            targetMeasure.sequences[targetSequenceIndex] = replacement;
          }
        } else if (targetSequenceIndex !== undefined) {
          // A sparse VOICE clip's gap is a real absence: this voice has no
          // bar copy there, and absence is silence for a voice.
          targetMeasure.sequences.splice(targetSequenceIndex, 1);
        }
        if (source?.declarations) {
          const remap = <T extends { staff?: number; voice?: string }>(entries: T[] | undefined): T[] =>
            cloneJson(entries ?? []).map(entry => {
              if (staffIndex === 1) delete entry.staff;
              else entry.staff = staffIndex;
              return entry;
            });
          if (source.declarations.beams?.length)
            targetMeasure.beams = [...(targetMeasure.beams ?? []), ...cloneJson(source.declarations.beams)];
          if (source.declarations.ottavas?.length)
            targetMeasure.ottavas = [...(targetMeasure.ottavas ?? []), ...remap(source.declarations.ottavas)];
          if (source.declarations.dynamics?.length)
            targetMeasure.dynamics = [...(targetMeasure.dynamics ?? []), ...remap(source.declarations.dynamics)];
          if (source.declarations.directions?.length)
            targetMeasure.directions = [...(targetMeasure.directions ?? []), ...remap(source.declarations.directions)];
        }
      }
      resultLanding = landing(state, 'voiceMeasure', targetStart, targetStart + clip.span - 1);
      break;
    }
    case 'staff-bars': {
      const targetStart = anchorBarStart(destination, state, projection);
      const part = after.parts[partIndex];
      // The cursor cannot address a staff a part does not have, but stay
      // defensive: land on the nearest staff rather than refusing.
      const targetStaff = Math.min(staffIndex, part?.staves ?? 1);
      ensureBars(after, targetStart + clip.span - 1, accommodations);
      accommodations.flaggedNotes += countUnplayableAnnotations(
        clip.bars.flatMap(bar => notesInMeasure(bar.measure)),
        destination.parts[partIndex]
      );
      bindContextMeasures(envelope, after, targetStart, ids);
      clip.bars.forEach(bar => rewriteMeasure(bar.measure, ids));
      for (let offset = 0; offset < clip.span; offset++) {
        replaceSelectionStaffMaterial(
          after.parts[partIndex].measures[targetStart + offset],
          clip.bars.find(bar => bar.offset === offset)?.measure ?? null,
          targetStaff
        );
      }
      resultLanding = landing(state, 'partMeasure', targetStart, targetStart + clip.span - 1);
      break;
    }
    case 'part': {
      const empty = isEmptyDocument(destination);
      let globalMeasures: MnxGlobalMeasure[] | null = null;
      if (empty) {
        // Bootstrap the timeline from the clip's measure context; a context
        // shorter than the part's bars synthesizes empty globals (rule 4's
        // spirit — never refuse for missing context).
        const contexts = envelope.context?.measures ?? [];
        globalMeasures = clip.part.measures.map((_, index) => {
          const context = contexts[index];
          return cloneJson({
            ...(context?.id ? { id: context.id } : {}),
            ...(context?.key ? { key: context.key } : {}),
            ...(context?.time ? { time: context.time } : {})
          });
        });
        globalMeasures.forEach(measure => { if (measure.id) measure.id = ids.map('measures', measure.id); });
        contexts.forEach((context, index) => {
          if (context.id && globalMeasures![index]?.id)
            ids.bind('measures', context.id, globalMeasures![index].id!);
        });
      } else {
        bindContextMeasures(envelope, after, 0, ids);
        // Rule 4 both ways: a short part pads to the timeline, a long part
        // extends the timeline (empty bars land in every other part).
        while (clip.part.measures.length < after.global.measures.length) {
          clip.part.measures.push(emptyPartBar());
        }
        ensureBars(after, clip.part.measures.length - 1, accommodations);
      }
      rewritePart(clip.part, ids);
      if (empty) {
        after.global.measures = globalMeasures!;
        after.parts = [clip.part];
      } else {
        after.parts.push(clip.part);
      }
      const addedIndex = empty ? 0 : after.parts.length - 1;
      resultLanding = {
        level: 'partMeasure', partIndex: addedIndex, staffIndex: 1, voiceIndex: 0,
        measureStart: 0, measureEnd: Math.max(0, clip.part.measures.length - 1),
        onsetStart: [0, 1], onsetEnd: [0, 1], closure: 'part'
      };
      break;
    }
    case 'measures':
    case 'section': {
      const level = clip.kind === 'measures' ? 'measure' as const : 'section' as const;
      const columns = clip.kind === 'measures'
        ? clip.measures
        : clip.sections.flatMap(section => section.measures);
      const start = anchorBarStart(destination, state, projection);
      // D3: positional part mapping, creating what the clip carries and the
      // destination lacks — dropping a part's material is the one thing
      // worse than refusing.
      while (after.parts.length < clip.parts.length) {
        const descriptor = cloneJson(clip.parts[after.parts.length]);
        const created = { ...descriptor, measures: [] as MnxPartMeasure[] } as MnxPart;
        if (created.id) created.id = ids.map('parts', created.id);
        while (created.measures.length < after.global.measures.length) created.measures.push(emptyPartBar());
        after.parts.push(created);
        accommodations.createdParts++;
      }
      ensureBars(after, start + columns.length - 1, accommodations);
      clip.parts.forEach((_, index) => {
        accommodations.flaggedNotes += countUnplayableAnnotations(
          columns.flatMap(column => notesInMeasure(column.parts[index])),
          after.parts[index]
        );
      });
      columns.forEach(column => {
        if (column.global.id) column.global.id = ids.map('measures', column.global.id);
        column.parts.forEach(measure => rewriteMeasure(measure, ids));
      });
      // D1: paste overwrites — the insert-before-a-point behavior retired
      // with the conservative contract; "insert bars" is a future command.
      const oldToNew = new Map<string, string>();
      columns.forEach((column, offset) => {
        const oldId = after.global.measures[start + offset]?.id;
        const newId = column.global.id;
        if (oldId && newId) oldToNew.set(oldId, newId);
      });
      after.global.measures.splice(start, columns.length, ...columns.map(column => column.global));
      after.parts.forEach((part, index) => {
        const replacement = index < clip.parts.length
          ? columns.map(column => column.parts[index])
          : columns.map(() => emptyPartBar());
        part.measures.splice(start, columns.length, ...replacement);
      });
      rewriteExistingMeasureReferences(after, oldToNew);
      resultLanding = landing(state, level, start, start + columns.length - 1);
      break;
    }
    case 'score': {
      // D5: the footprint of a score is everything — paste replaces the
      // document, and undo restores it. No emptiness precondition.
      rewriteWholeScore(clip.score, ids);
      merge = undefined;
      accommodations.replacedDocument = true;
      resultLanding = {
        level: 'score', partIndex: 0, staffIndex: 1, voiceIndex: 0,
        measureStart: 0, measureEnd: Math.max(0, clip.score.global.measures.length - 1),
        onsetStart: [0, 1], onsetEnd: [0, 1], closure: 'score'
      };
      const detached = pruneDanglingSelectionReferences(clip.score);
      return {
        ok: true,
        clipKind: clip.kind,
        document: cloneJson(clip.score),
        idMap: cloneJson(ids.maps),
        landing: resultLanding,
        detachedTargetReferences: detached,
        accommodations
      };
    }
  }

  applyDependencies(after, merge);
  const detachedTargetReferences = pruneDanglingSelectionReferences(after);
  return {
    ok: true,
    clipKind: clip.kind,
    document: cloneJson(after),
    idMap: cloneJson(ids.maps),
    landing: resultLanding,
    ...(merge ? { dependencyMerge: cloneJson(merge) } : {}),
    detachedTargetReferences,
    accommodations
  };
}
