// Pure, conservative clipboard paste planning.
//
// The planner owns all compatibility decisions and builds a complete detached
// next document. It never mutates the supplied score, reads a clipboard, or
// writes editor history; selectionClipboardActions/session commit an accepted
// plan atomically at the environment/history boundary.
import type {
  MnxBeam,
  MnxEvent,
  MnxGlobalMeasure,
  MnxLayoutContent,
  MnxNote,
  MnxOttava,
  MnxPart,
  MnxPartMeasure,
  MnxSequenceItem,
  MnxStructure
} from '../model/mnx.ts';
import { isTimedEvent } from '../model/mnx.ts';
import {
  addOnsets,
  itemSpan,
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
  type EventRunClipEntry,
  type SelectionClipDependencies,
  type SelectionClipEnvelope
} from './selectionClip.ts';
import { midiOfPitch } from './tabStrings.ts';

export type PasteRefusalCode =
  | 'invalid-clip'
  | 'unsupported-version'
  | 'wrong-destination-level'
  | 'empty-destination'
  | 'member-count-mismatch'
  | 'metric-span-mismatch'
  | 'bar-span-mismatch'
  | 'partial-container'
  | 'missing-voice'
  | 'missing-staff'
  | 'part-topology-mismatch'
  | 'measure-count-mismatch'
  | 'document-not-empty'
  | 'instrument-incompatible'
  | 'invalid-payload';

export interface PasteRefusal {
  ok: false;
  code: PasteRefusalCode;
  message: string;
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
}

export type PastePlanResult = PastePlan | PasteRefusal;

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function refuse(code: PasteRefusalCode, message: string): PasteRefusal {
  return { ok: false, code, message };
}

function isRefusal<T>(value: T | PasteRefusal): value is PasteRefusal {
  return typeof value === 'object' && value !== null && 'ok' in value && value.ok === false;
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

function eventForMember(
  doc: MnxStructure,
  member: Extract<SelectionMember, { kind: 'note' | 'event' }>
): { event: MnxEvent; sequenceIndex: number } | null {
  const sequenceIndex = sequenceIndexAt(
    doc,
    member.partIndex,
    member.staffIndex,
    member.measureIndex,
    member.voiceIndex
  );
  if (sequenceIndex === undefined) return null;
  const item = doc.parts[member.partIndex].measures[member.measureIndex]
    .sequences[sequenceIndex].content[member.eventIndex];
  if (!item) return null;
  const event = member.containerIndex === undefined
    ? (isTimedEvent(item) ? item : null)
    : ((item as { content?: MnxEvent[] }).content?.[member.containerIndex] ?? null);
  return event ? { event, sequenceIndex } : null;
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

function annotatedNotesCompatible(notes: MnxNote[], part: MnxPart | undefined): PasteRefusal | null {
  const annotated = notes.filter(note => note._x?.mnxLab?.string !== undefined);
  if (annotated.length === 0) return null;
  const strings = part?._x?.mnxLab?.strings;
  if (!strings?.length) {
    return refuse('instrument-incompatible', 'The copied string annotations need a declared destination instrument.');
  }
  const capo = part?._x?.mnxLab?.capo ?? 0;
  for (const note of annotated) {
    const number = note._x!.mnxLab!.string!;
    const string = strings.find(entry => entry.string === number);
    if (!string) return refuse('instrument-incompatible', `Destination string ${number} is not declared.`);
    const fret = midiOfPitch(note.pitch) - (midiOfPitch(string.pitch) + capo);
    if (fret < 0 || fret > 24 || (note._x!.mnxLab!.fret !== undefined && note._x!.mnxLab!.fret !== fret)) {
      return refuse('instrument-incompatible', `The copied note is not playable on destination string ${number}.`);
    }
  }
  return null;
}

function partTopologyMatches(
  descriptors: { staves?: number }[],
  target: MnxStructure
): boolean {
  return descriptors.length === target.parts.length && descriptors.every(
    (descriptor, index) => (descriptor.staves ?? 1) === (target.parts[index]?.staves ?? 1)
  );
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

function eventUnitKey(unit: Pick<EventUnit, 'measureIndex' | 'sequenceIndex' | 'itemIndex'>): string {
  return `${unit.measureIndex}:${unit.sequenceIndex}:${unit.itemIndex}`;
}

function selectedEventUnits(
  doc: MnxStructure,
  state: SelectionState,
  projection: Projection,
  sourceBars: EventRunClipEntry[],
  sourceTimelineSpan: number
): EventUnit[] | PasteRefusal {
  const resolved = resolveSelection(doc, state, projection);
  const members = resolved.members.filter(
    (member): member is Extract<SelectionMember, { kind: 'event' }> => member.kind === 'event'
  );
  if (members.length === 0) return refuse('empty-destination', 'There is no destination event.');
  const universe = activeVoiceUnits(doc, state);
  const unitByKey = new Map(universe.map(unit => [eventUnitKey(unit), unit]));

  const memberUnit = (member: typeof members[number]): EventUnit | null => {
    const sequenceIndex = sequenceIndexAt(
      doc, member.partIndex, member.staffIndex, member.measureIndex, member.voiceIndex
    );
    return sequenceIndex === undefined
      ? null
      : (unitByKey.get(`${member.measureIndex}:${sequenceIndex}:${member.eventIndex}`) ?? null);
  };

  if (sameSelectionCursor(state)) {
    const member = members[0];
    if (member.containerIndex !== undefined) {
      return refuse('partial-container', 'An event paste cannot anchor inside a rhythm container.');
    }
    const first = memberUnit(member);
    if (!first) return refuse('empty-destination', 'The destination event no longer exists.');
    const selected: EventUnit[] = [];
    const firstSource = sourceBars[0];
    const delta = addOnsets(first.onset, { num: -firstSource.onset[0], den: firstSource.onset[1] });
    if (state.anchor.measureIndex + sourceTimelineSpan > doc.global.measures.length) {
      return refuse('bar-span-mismatch', 'The event run extends beyond the destination timeline.');
    }
    for (const sourceBar of sourceBars) {
      const measureIndex = first.measureIndex + sourceBar.offset;
      const expectedOnset = addOnsets(
        { num: sourceBar.onset[0], den: sourceBar.onset[1] },
        delta
      );
      const sourceSpan = addSpan(sourceBar.items);
      const start = universe.findIndex(unit =>
        unit.measureIndex === measureIndex && onsetsEqual(unit.onset, expectedOnset)
      );
      if (start < 0) {
        return refuse('metric-span-mismatch', 'A destination bar has no event at the required translated onset.');
      }
      let span: Onset = { num: 0, den: 1 };
      for (let index = start; index < universe.length && universe[index].measureIndex === measureIndex; index++) {
        selected.push(universe[index]);
        span = addOnsets(span, itemSpan(universe[index].item));
        const comparison = compareSpan(span, sourceSpan);
        if (comparison === 0) break;
        if (comparison > 0) {
          return refuse('metric-span-mismatch', 'A destination bar does not close to the copied metric span.');
        }
      }
      if (!onsetsEqual(span, sourceSpan)) {
        return refuse('metric-span-mismatch', 'A destination bar does not close to the copied metric span.');
      }
    }
    return selected;
  }

  const childCounts = new Map<string, Set<number>>();
  for (const member of members) {
    if (member.containerIndex === undefined) continue;
    const unit = memberUnit(member);
    if (!unit) return refuse('empty-destination', 'A destination event no longer exists.');
    const key = eventUnitKey(unit);
    const selected = childCounts.get(key) ?? new Set<number>();
    selected.add(member.containerIndex);
    childCounts.set(key, selected);
  }
  for (const [key, children] of childCounts) {
    const count = ((unitByKey.get(key)?.item as { content?: MnxEvent[] } | undefined)?.content ?? []).length;
    if (children.size !== count) {
      return refuse('partial-container', 'The destination range cuts through a rhythm container.');
    }
  }
  const selected = [...new Map(members.flatMap(member => {
    const unit = memberUnit(member);
    return unit ? [[eventUnitKey(unit), unit] as const] : [];
  })).values()];
  const firstMeasure = selected[0].measureIndex;
  const targetBars = [...new Set(selected.map(unit => unit.measureIndex))].map(measureIndex => ({
    offset: measureIndex - firstMeasure,
    units: selected.filter(unit => unit.measureIndex === measureIndex)
  }));
  if (
    selected[selected.length - 1].measureIndex - firstMeasure + 1 !== sourceTimelineSpan ||
    targetBars.length !== sourceBars.length ||
    targetBars.some((bar, index) =>
      bar.offset !== sourceBars[index].offset ||
      !onsetsEqual(addSpan(bar.units.map(unit => unit.item)), addSpan(sourceBars[index].items))
    )
  ) {
    return refuse('metric-span-mismatch', 'Destination event bars differ from the copied bar-local spans.');
  }
  return selected;
}

interface EventSlice {
  measureIndex: number;
  sequenceIndex: number;
  from: number;
  count: number;
  span: Onset;
  items: MnxSequenceItem[];
}

function eventSlices(units: EventUnit[], sourceItems: MnxSequenceItem[]): EventSlice[] | PasteRefusal {
  const slices: EventSlice[] = [];
  for (const unit of units) {
    const prior = slices[slices.length - 1];
    if (prior && prior.measureIndex === unit.measureIndex && prior.sequenceIndex === unit.sequenceIndex &&
      prior.from + prior.count === unit.itemIndex) {
      prior.count++;
      prior.span = addOnsets(prior.span, itemSpan(unit.item));
    } else {
      slices.push({
        measureIndex: unit.measureIndex,
        sequenceIndex: unit.sequenceIndex,
        from: unit.itemIndex,
        count: 1,
        span: itemSpan(unit.item),
        items: []
      });
    }
  }
  let sourceIndex = 0;
  for (const slice of slices) {
    let span: Onset = { num: 0, den: 1 };
    while (sourceIndex < sourceItems.length && compareSpan(span, slice.span) < 0) {
      const item = sourceItems[sourceIndex++];
      slice.items.push(item);
      span = addOnsets(span, itemSpan(item));
    }
    if (!onsetsEqual(span, slice.span)) {
      return refuse('bar-span-mismatch', 'Copied events cannot fill destination bar slices without splitting an item.');
    }
  }
  if (sourceIndex !== sourceItems.length) {
    return refuse('bar-span-mismatch', 'Copied events leave material beyond the destination bar slices.');
  }
  return slices;
}

function eventSlicesByBar(
  units: EventUnit[],
  sourceBars: EventRunClipEntry[]
): EventSlice[] | PasteRefusal {
  const start = units[0].measureIndex;
  const slices: EventSlice[] = [];
  for (const sourceBar of sourceBars) {
    const target = units.filter(unit => unit.measureIndex === start + sourceBar.offset);
    const planned = eventSlices(target, sourceBar.items);
    if (isRefusal(planned)) return planned;
    slices.push(...planned);
  }
  return slices;
}

function destinationBarStart(
  doc: MnxStructure,
  state: SelectionState,
  projection: Projection,
  span: number
): number | PasteRefusal {
  if (state.extent.kind === 'cursor' && !sameSelectionCursor(state)) {
    const start = Math.min(state.anchor.measureIndex, state.extent.cursor.measureIndex);
    const end = Math.max(state.anchor.measureIndex, state.extent.cursor.measureIndex);
    return end - start + 1 === span
      ? start
      : refuse('bar-span-mismatch', `Destination range must cover exactly ${span} bars.`);
  }
  if (state.extent.kind === 'closure') {
    const measures = resolveSelection(doc, state, projection).members.flatMap(member =>
      member.kind === 'voiceMeasure' || member.kind === 'partMeasure' ? [member.measureIndex] : []
    );
    if (!measures.length) return refuse('empty-destination', 'The destination closure has no bars.');
    const start = Math.min(...measures);
    const end = Math.max(...measures);
    return end - start + 1 === span
      ? start
      : refuse('bar-span-mismatch', `Destination closure must cover exactly ${span} bars.`);
  }
  return state.anchor.measureIndex;
}

function mergeRelationships(
  after: MnxStructure,
  partIndex: number,
  targetStart: number,
  relationships: ClipBarRelationships[] | undefined
): void {
  relationships?.forEach(source => {
    const measure = after.parts[partIndex]?.measures?.[targetStart + source.offset];
    if (!measure) return;
    if (source.beams?.length) measure.beams = [...(measure.beams ?? []), ...cloneJson(source.beams)];
    if (source.ottavas?.length) measure.ottavas = [...(measure.ottavas ?? []), ...cloneJson(source.ottavas)];
  });
}

function replaceStaffMaterial(target: MnxPartMeasure, source: MnxPartMeasure | null, staffIndex: number): void {
  const removedEventIds = new Set<string>();
  target.sequences.filter(sequence => (sequence.staff ?? 1) === staffIndex).forEach(sequence =>
    visitItems(sequence.content, event => { if (event.id) removedEventIds.add(event.id); })
  );
  target.sequences = target.sequences.filter(sequence => (sequence.staff ?? 1) !== staffIndex);
  if (source) {
    const sequences = cloneJson(source.sequences).map(sequence => ({
      ...sequence,
      ...(staffIndex === 1 ? { staff: sequence.staff } : { staff: staffIndex })
    }));
    sequences.forEach(sequence => { if (staffIndex === 1 && sequence.staff === undefined) delete sequence.staff; });
    target.sequences.push(...sequences);
  }
  const replaceScoped = <K extends 'clefs' | 'dynamics' | 'directions' | 'ottavas'>(key: K): void => {
    const existing = target[key] as ({ staff?: number }[] | undefined);
    const incoming = source?.[key] as ({ staff?: number }[] | undefined);
    const kept = (existing ?? []).filter(entry => (entry.staff ?? 1) !== staffIndex);
    const remapped = cloneJson(incoming ?? []).map(entry => {
      if (staffIndex === 1) delete entry.staff;
      else entry.staff = staffIndex;
      return entry;
    });
    const next = [...kept, ...remapped];
    if (next.length) (target as unknown as Record<string, unknown>)[key] = next;
    else delete (target as unknown as Record<string, unknown>)[key];
  };
  replaceScoped('clefs');
  replaceScoped('dynamics');
  replaceScoped('directions');
  replaceScoped('ottavas');
  if (removedEventIds.size && target.beams) {
    target.beams = target.beams.filter(beam => !beam.events.some(id => removedEventIds.has(id)));
    if (!target.beams.length) delete target.beams;
  }
  if (source?.beams?.length) target.beams = [...(target.beams ?? []), ...cloneJson(source.beams)];
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

function pruneDanglingReferences(doc: MnxStructure): number {
  const notes = allNotes(doc);
  const events = allEvents(doc);
  const noteIds = new Set(notes.flatMap(note => note.id ? [note.id] : []));
  const eventIds = new Set(events.flatMap(event => event.id ? [event.id] : []));
  const measureIds = new Set(doc.global.measures.flatMap(measure => measure.id ? [measure.id] : []));
  let detached = 0;
  notes.forEach(note => {
    if (note.ties) {
      const kept = note.ties.filter(tie => tie.target === undefined || noteIds.has(tie.target) || (++detached, false));
      if (kept.length) note.ties = kept;
      else delete note.ties;
    }
    const technique = note._x?.mnxLab?.tab?.technique as
      | Record<string, { target?: string } | boolean | undefined>
      | undefined;
    Object.entries(technique ?? {}).forEach(([key, value]) => {
      if (value && typeof value === 'object' && value.target && !noteIds.has(value.target)) {
        delete technique![key];
        detached++;
      }
    });
    const tab = note._x?.mnxLab?.tab;
    if (tab?.technique && Object.keys(tab.technique).length === 0) delete tab.technique;
    if (tab && Object.keys(tab).length === 0) delete note._x!.mnxLab!.tab;
    if (note._x?.mnxLab && Object.keys(note._x.mnxLab).length === 0) delete note._x.mnxLab;
    if (note._x && Object.keys(note._x).length === 0) delete note._x;
  });
  events.forEach(event => {
    if (!event.slurs) return;
    const kept = event.slurs.filter(slur => {
      const closed = eventIds.has(slur.target) &&
        (!slur.startNote || noteIds.has(slur.startNote)) &&
        (!slur.endNote || noteIds.has(slur.endNote));
      if (!closed) detached++;
      return closed;
    });
    if (kept.length) event.slurs = kept;
    else delete event.slurs;
  });
  const pruneBeams = (beams: MnxBeam[]): MnxBeam[] => beams.filter(beam => {
    const closed = beam.events.every(id => eventIds.has(id));
    if (!closed) detached++;
    if (closed && beam.beams) {
      beam.beams = pruneBeams(beam.beams);
      if (!beam.beams.length) delete beam.beams;
    }
    return closed;
  });
  doc.parts.forEach(part => part.measures.forEach(measure => {
    if (measure.beams) {
      measure.beams = pruneBeams(measure.beams);
      if (!measure.beams.length) delete measure.beams;
    }
    if (measure.ottavas) {
      const kept = measure.ottavas.filter(ottava => measureIds.has(ottava.end.measure) || (++detached, false));
      if (kept.length) measure.ottavas = kept;
      else delete measure.ottavas;
    }
  }));
  return detached;
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
  let resultLanding: PasteLanding;
  let merge = envelope.clip.kind === 'score'
    ? undefined
    : mergedDependencies(destination, envelope.dependencies);
  const clip = cloneJson(envelope.clip);

  switch (clip.kind) {
    case 'note-set': {
      if (state.level !== 'note') return refuse('wrong-destination-level', 'Note clips paste only onto note selections.');
      const members = resolveSelection(destination, state, projection).members.filter(
        (member): member is Extract<SelectionMember, { kind: 'note' }> => member.kind === 'note'
      );
      if (!members.length) return refuse('empty-destination', 'There is no destination note.');
      if ((sameSelectionCursor(state) && clip.notes.length !== 1) || members.length !== clip.notes.length) {
        return refuse('member-count-mismatch', 'Source and destination note selections must have equal counts.');
      }
      const compatibility = annotatedNotesCompatible(clip.notes, destination.parts[partIndex]);
      if (compatibility) return compatibility;
      clip.notes.forEach(note => rewriteNote(note, ids));
      members.forEach((member, index) => {
        const located = eventForMember(after, member);
        if (!located?.event.notes?.[member.noteIndex]) return;
        located.event.notes[member.noteIndex] = clip.notes[index];
      });
      resultLanding = landing(
        state,
        'note',
        members[0].measureIndex,
        members[members.length - 1].measureIndex,
        members[0].onset,
        members[members.length - 1].onset
      );
      break;
    }
    case 'event-run': {
      if (state.level !== 'event') return refuse('wrong-destination-level', 'Event clips paste only onto event selections.');
      const sourceItems = clip.bars.flatMap(bar => bar.items);
      const compatibility = annotatedNotesCompatible(notesInItems(sourceItems), destination.parts[partIndex]);
      if (compatibility) return compatibility;
      if (sourceItems.every(item => itemSpan(item).num === 0))
        return refuse('metric-span-mismatch', 'Zero-time event runs must paste at container level.');
      const units = selectedEventUnits(destination, state, projection, clip.bars, clip.span);
      if (isRefusal(units)) return units;
      const targetStart = units[0].measureIndex;
      bindContextMeasures(envelope, after, targetStart, ids);
      clip.bars.forEach(bar => rewriteItems(bar.items, ids));
      const slices = eventSlicesByBar(units, clip.bars);
      if (isRefusal(slices)) return slices;
      [...slices].reverse().forEach(slice => {
        after.parts[partIndex].measures[slice.measureIndex].sequences[slice.sequenceIndex]
          .content.splice(slice.from, slice.count, ...slice.items);
      });
      const relationships = rewriteRelationships(envelope.relationships?.measures, ids);
      mergeRelationships(after, partIndex, targetStart, relationships);
      const firstSourceBar = clip.bars[0];
      const lastSourceBar = clip.bars[clip.bars.length - 1];
      const onsetDelta = addOnsets(
        units[0].onset,
        { num: -firstSourceBar.onset[0], den: firstSourceBar.onset[1] }
      );
      const lastSourceOnset = lastSourceBar.items.slice(0, -1).reduce(
        (onset, item) => addOnsets(onset, itemSpan(item)),
        addOnsets(
          { num: lastSourceBar.onset[0], den: lastSourceBar.onset[1] },
          onsetDelta
        )
      );
      resultLanding = landing(
        state,
        'event',
        targetStart,
        targetStart + lastSourceBar.offset,
        units[0].onset,
        lastSourceOnset
      );
      break;
    }
    case 'container-run': {
      if (state.level !== 'container') return refuse('wrong-destination-level', 'Container clips paste only onto container selections.');
      const compatibility = annotatedNotesCompatible(
        clip.bars.flatMap(bar => bar.containers.flatMap(container => notesInItems([container]))),
        destination.parts[partIndex]
      );
      if (compatibility) return compatibility;
      const universe = activeVoiceUnits(destination, state).filter(unit => !isTimedEvent(unit.item));
      const resolved = resolveSelection(destination, state, projection).members.filter(
        (member): member is Extract<SelectionMember, { kind: 'container' }> => member.kind === 'container'
      );
      if (!resolved.length) return refuse('empty-destination', 'There is no destination container.');
      let targets = resolved.flatMap(member => universe.filter(unit =>
        unit.measureIndex === member.measureIndex && unit.sequenceIndex === member.sequenceIndex &&
        unit.itemIndex === member.eventIndex
      ));
      targets = [...new Map(targets.map(unit => [eventUnitKey(unit), unit])).values()];
      const sourceContainers = clip.bars.flatMap(bar => bar.containers);
      if (sameSelectionCursor(state)) {
        const first = targets[0];
        const firstSource = clip.bars[0];
        const delta = addOnsets(first.onset, { num: -firstSource.onset[0], den: firstSource.onset[1] });
        const planned: EventUnit[] = [];
        for (const sourceBar of clip.bars) {
          const measureIndex = first.measureIndex + sourceBar.offset;
          const expectedOnset = addOnsets(
            { num: sourceBar.onset[0], den: sourceBar.onset[1] },
            delta
          );
          const candidates = universe.filter(unit => unit.measureIndex === measureIndex);
          const start = candidates.findIndex(unit => onsetsEqual(unit.onset, expectedOnset));
          if (start < 0 || start + sourceBar.containers.length > candidates.length) {
            return refuse('member-count-mismatch', 'A destination bar lacks the required container run.');
          }
          planned.push(...candidates.slice(start, start + sourceBar.containers.length));
        }
        targets = planned;
      } else {
        const firstMeasure = targets[0].measureIndex;
        const targetBars = [...new Set(targets.map(target => target.measureIndex))].map(measureIndex => ({
          offset: measureIndex - firstMeasure,
          targets: targets.filter(target => target.measureIndex === measureIndex)
        }));
        if (
          targets[targets.length - 1].measureIndex - firstMeasure + 1 !== clip.span ||
          targetBars.length !== clip.bars.length ||
          targetBars.some((bar, index) =>
            bar.offset !== clip.bars[index].offset ||
            bar.targets.length !== clip.bars[index].containers.length
          )
        ) return refuse('member-count-mismatch', 'Destination container bars differ from the copied run.');
      }
      if (targets.length !== sourceContainers.length) {
        return refuse('member-count-mismatch', 'Source and destination container selections must have equal counts.');
      }
      if (targets.some((target, index) => !onsetsEqual(itemSpan(target.item), itemSpan(sourceContainers[index])))) {
        return refuse('metric-span-mismatch', 'Each destination container must have the copied container span.');
      }
      const targetStart = targets[0].measureIndex;
      bindContextMeasures(envelope, after, targetStart, ids);
      rewriteItems(sourceContainers, ids);
      [...targets].reverse().forEach((target, reverseIndex) => {
        const sourceIndex = targets.length - reverseIndex - 1;
        after.parts[partIndex].measures[target.measureIndex].sequences[target.sequenceIndex]
          .content.splice(target.itemIndex, 1, sourceContainers[sourceIndex]);
      });
      const relationships = rewriteRelationships(envelope.relationships?.measures, ids);
      mergeRelationships(after, partIndex, targetStart, relationships);
      resultLanding = landing(
        state,
        'container',
        targetStart,
        targets[targets.length - 1].measureIndex,
        targets[0].onset,
        targets[targets.length - 1].onset
      );
      break;
    }
    case 'voice-bars': {
      if (state.level !== 'voiceMeasure') return refuse('wrong-destination-level', 'Voice clips paste only onto voice-bar selections.');
      const targetStart = destinationBarStart(destination, state, projection, clip.span);
      if (isRefusal(targetStart)) return targetStart;
      if (targetStart + clip.span > destination.global.measures.length)
        return refuse('bar-span-mismatch', 'The voice clip extends beyond the destination timeline.');
      const compatibility = annotatedNotesCompatible(
        clip.bars.flatMap(bar => notesInItems(bar.sequence.content)),
        destination.parts[partIndex]
      );
      if (compatibility) return compatibility;
      bindContextMeasures(envelope, after, targetStart, ids);
      clip.bars.forEach(bar => {
        rewriteItems(bar.sequence.content, ids);
        bar.declarations?.beams?.forEach(beam => rewriteBeam(beam, ids));
        bar.declarations?.ottavas?.forEach(ottava => rewriteOttava(ottava, ids));
      });
      for (let offset = 0; offset < clip.span; offset++) {
        const targetMeasure = after.parts[partIndex]?.measures?.[targetStart + offset];
        if (!targetMeasure) return refuse('missing-voice', 'The destination part has no bar at the requested offset.');
        const targetSequenceIndex = sequenceIndexAt(after, partIndex, staffIndex, targetStart + offset, voiceIndex);
        const source = clip.bars.find(bar => bar.offset === offset);
        if (source && targetSequenceIndex === undefined)
          return refuse('missing-voice', 'Paste would need to create a destination voice.');
        if (targetSequenceIndex !== undefined) {
          if (source) {
            const priorVoice = targetMeasure.sequences[targetSequenceIndex].voice;
            const replacement = cloneJson(source.sequence);
            if (staffIndex === 1) delete replacement.staff;
            else replacement.staff = staffIndex;
            if (priorVoice === undefined) delete replacement.voice;
            else replacement.voice = priorVoice;
            targetMeasure.sequences[targetSequenceIndex] = replacement;
          }
          else targetMeasure.sequences.splice(targetSequenceIndex, 1);
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
      if (state.level !== 'partMeasure' || state.extent.kind === 'closure')
        return refuse('wrong-destination-level', 'Staff clips paste only onto concrete staff-bar selections.');
      const targetStart = destinationBarStart(destination, state, projection, clip.span);
      if (isRefusal(targetStart)) return targetStart;
      const part = destination.parts[partIndex];
      if (!part || staffIndex > (part.staves ?? 1)) return refuse('missing-staff', 'The destination staff does not exist.');
      if (targetStart + clip.span > destination.global.measures.length)
        return refuse('bar-span-mismatch', 'The staff clip extends beyond the destination timeline.');
      const compatibility = annotatedNotesCompatible(
        clip.bars.flatMap(bar => notesInMeasure(bar.measure)), part
      );
      if (compatibility) return compatibility;
      bindContextMeasures(envelope, after, targetStart, ids);
      clip.bars.forEach(bar => rewriteMeasure(bar.measure, ids));
      for (let offset = 0; offset < clip.span; offset++) {
        const target = after.parts[partIndex].measures[targetStart + offset];
        if (!target) return refuse('missing-staff', 'The destination part has no corresponding bar.');
        replaceStaffMaterial(target, clip.bars.find(bar => bar.offset === offset)?.measure ?? null, staffIndex);
      }
      resultLanding = landing(state, 'partMeasure', targetStart, targetStart + clip.span - 1);
      break;
    }
    case 'part': {
      if (state.level !== 'partMeasure' && state.level !== 'score')
        return refuse('wrong-destination-level', 'Part clips paste only at part or score level.');
      const empty = isEmptyDocument(destination);
      if (!empty && clip.part.measures.length !== destination.global.measures.length)
        return refuse('measure-count-mismatch', 'The copied part must match the destination timeline length.');
      let globalMeasures: MnxGlobalMeasure[] | null = null;
      if (empty) {
        const contexts = envelope.context?.measures ?? [];
        if (contexts.length !== clip.part.measures.length)
          return refuse('measure-count-mismatch', 'The copied part lacks complete context for an empty destination.');
        globalMeasures = contexts.map(context => cloneJson({
          ...(context.id ? { id: context.id } : {}),
          ...(context.key ? { key: context.key } : {}),
          ...(context.time ? { time: context.time } : {})
        }));
        globalMeasures.forEach(measure => { if (measure.id) measure.id = ids.map('measures', measure.id); });
        contexts.forEach((context, index) => {
          if (context.id && globalMeasures![index].id) ids.bind('measures', context.id, globalMeasures![index].id!);
        });
      } else {
        bindContextMeasures(envelope, after, 0, ids);
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
    case 'measures': {
      if (state.level !== 'measure') return refuse('wrong-destination-level', 'Measure clips paste only onto measure selections.');
      if (!partTopologyMatches(clip.parts, destination))
        return refuse('part-topology-mismatch', 'Copied measure columns require the same part/staff topology.');
      for (let index = 0; index < clip.parts.length; index++) {
        const compatibility = annotatedNotesCompatible(
          clip.measures.flatMap(column => notesInMeasure(column.parts[index])),
          destination.parts[index]
        );
        if (compatibility) return compatibility;
      }
      const insert = sameSelectionCursor(state);
      const resolved = resolveSelection(destination, state, projection).members.filter(
        (member): member is Extract<SelectionMember, { kind: 'measure' }> => member.kind === 'measure'
      );
      if (!insert && resolved.length !== clip.measures.length)
        return refuse('measure-count-mismatch', 'Destination measure range must equal the copied column count.');
      const start = insert ? state.anchor.measureIndex : resolved[0]?.measureIndex;
      if (start === undefined) return refuse('empty-destination', 'There is no destination measure.');
      clip.measures.forEach(column => {
        if (column.global.id) column.global.id = ids.map('measures', column.global.id);
        column.parts.forEach(measure => rewriteMeasure(measure, ids));
      });
      const oldToNew = new Map<string, string>();
      if (!insert) resolved.forEach((member, index) => {
        const oldId = after.global.measures[member.measureIndex]?.id;
        const newId = clip.measures[index].global.id;
        if (oldId && newId) oldToNew.set(oldId, newId);
      });
      after.global.measures.splice(start, insert ? 0 : clip.measures.length, ...clip.measures.map(column => column.global));
      after.parts.forEach((part, index) => part.measures.splice(
        start, insert ? 0 : clip.measures.length, ...clip.measures.map(column => column.parts[index])
      ));
      rewriteExistingMeasureReferences(after, oldToNew);
      resultLanding = landing(state, 'measure', start, start + clip.measures.length - 1);
      break;
    }
    case 'section': {
      if (state.level !== 'section') return refuse('wrong-destination-level', 'Section clips paste only onto section selections.');
      if (!partTopologyMatches(clip.parts, destination))
        return refuse('part-topology-mismatch', 'Copied sections require the same part/staff topology.');
      const columns = clip.sections.flatMap(section => section.measures);
      for (let index = 0; index < clip.parts.length; index++) {
        const compatibility = annotatedNotesCompatible(
          columns.flatMap(column => notesInMeasure(column.parts[index])), destination.parts[index]
        );
        if (compatibility) return compatibility;
      }
      const insert = sameSelectionCursor(state);
      const resolved = resolveSelection(destination, state, projection).members.filter(
        (member): member is Extract<SelectionMember, { kind: 'section' }> => member.kind === 'section'
      );
      const targetCount = resolved.reduce((count, member) => count + member.end - member.start, 0);
      if (!insert && targetCount !== columns.length)
        return refuse('measure-count-mismatch', 'Destination section span must equal the copied section package.');
      const start = insert ? (resolved[0]?.start ?? state.anchor.measureIndex) : resolved[0]?.start;
      if (start === undefined) return refuse('empty-destination', 'There is no destination section.');
      columns.forEach(column => {
        if (column.global.id) column.global.id = ids.map('measures', column.global.id);
        column.parts.forEach(measure => rewriteMeasure(measure, ids));
      });
      const oldToNew = new Map<string, string>();
      if (!insert) Array.from({ length: columns.length }, (_, offset) => offset).forEach(offset => {
        const oldId = after.global.measures[start + offset]?.id;
        const newId = columns[offset].global.id;
        if (oldId && newId) oldToNew.set(oldId, newId);
      });
      after.global.measures.splice(start, insert ? 0 : columns.length, ...columns.map(column => column.global));
      after.parts.forEach((part, index) => part.measures.splice(
        start, insert ? 0 : columns.length, ...columns.map(column => column.parts[index])
      ));
      rewriteExistingMeasureReferences(after, oldToNew);
      resultLanding = landing(state, 'section', start, start + columns.length - 1);
      break;
    }
    case 'score': {
      if (state.level !== 'score') return refuse('wrong-destination-level', 'Score clips paste only at score level.');
      if (!isEmptyDocument(destination))
        return refuse('document-not-empty', 'A complete score can paste only into an explicitly empty document.');
      rewriteWholeScore(clip.score, ids);
      merge = undefined;
      resultLanding = {
        level: 'score', partIndex: 0, staffIndex: 1, voiceIndex: 0,
        measureStart: 0, measureEnd: Math.max(0, clip.score.global.measures.length - 1),
        onsetStart: [0, 1], onsetEnd: [0, 1], closure: 'score'
      };
      const detached = pruneDanglingReferences(clip.score);
      return {
        ok: true,
        clipKind: clip.kind,
        document: cloneJson(clip.score),
        idMap: cloneJson(ids.maps),
        landing: resultLanding,
        detachedTargetReferences: detached
      };
    }
  }

  applyDependencies(after, merge);
  const detachedTargetReferences = pruneDanglingReferences(after);
  return {
    ok: true,
    clipKind: clip.kind,
    document: cloneJson(after),
    idMap: cloneJson(ids.maps),
    landing: resultLanding,
    ...(merge ? { dependencyMerge: cloneJson(merge) } : {}),
    detachedTargetReferences
  };
}
