// Pure selection -> clipboard materialization.
//
// This module resolves a live SelectionState exactly once, copies the owned
// MNX fragments, closes every retained reference against that copied payload,
// and immediately proves the result through the transport codec. It performs
// no store write and no document mutation.
import type {
  MnxBeam,
  MnxEvent,
  MnxNote,
  MnxOttava,
  MnxPart,
  MnxPartMeasure,
  MnxSequence,
  MnxSequenceItem,
  MnxStructure
} from '../model/mnx.ts';
import { isTimedEvent } from '../model/mnx.ts';
import type { Projection } from './cursor.ts';
import {
  resolveSelection,
  type SelectionMember,
  type SelectionState
} from './selection.ts';
import {
  MNX_LAB_EXTENSION_VERSION,
  SELECTION_CLIP_FORMAT,
  SELECTION_CLIP_VERSION,
  decodeSelectionClip,
  encodeSelectionClip,
  type ClipBarRelationships,
  type ClipMeasureContext,
  type ClipPartDescriptor,
  type MeasureClipColumn,
  type SelectionClip,
  type SelectionClipDependencies,
  type SelectionClipEnvelope,
  type SelectionClipShape
} from './selectionClip.ts';

export type DetachedReferenceKind = 'tie' | 'slur' | 'beam' | 'technique' | 'ottava';

export interface DetachedSelectionReference {
  kind: DetachedReferenceKind;
  target: string;
}

export type SelectionClipExtractionRefusalCode =
  | 'empty-selection'
  | 'missing-source-member'
  | 'partial-container'
  | 'unsupported-note-member';

export interface SelectionClipExtractionRefusal {
  ok: false;
  code: SelectionClipExtractionRefusalCode;
  message: string;
}

export interface SelectionClipExtractionSuccess {
  ok: true;
  envelope: SelectionClipEnvelope;
  /** The exact value a clipboard transport writes; never a richer side path. */
  serialized: string;
  detached: DetachedSelectionReference[];
}

export type SelectionClipExtractionResult =
  | SelectionClipExtractionSuccess
  | SelectionClipExtractionRefusal;

function isRefusal(
  value: SelectionClip | SelectionClipExtractionRefusal
): value is SelectionClipExtractionRefusal {
  return 'ok' in value && value.ok === false;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function refuse(
  code: SelectionClipExtractionRefusalCode,
  message: string
): SelectionClipExtractionRefusal {
  return { ok: false, code, message };
}

function sameCursor(a: SelectionState['anchor'], b: SelectionState['anchor']): boolean {
  return (
    a.measureIndex === b.measureIndex &&
    a.onset.num * b.onset.den === b.onset.num * a.onset.den &&
    a.line === b.line &&
    a.slotIndex === b.slotIndex &&
    a.eventSlotIndex === b.eventSlotIndex &&
    (a.partIndex ?? 0) === (b.partIndex ?? 0) &&
    (a.staffIndex ?? 1) === (b.staffIndex ?? 1) &&
    (a.voiceIndex ?? 0) === (b.voiceIndex ?? 0)
  );
}

function selectionShape(state: SelectionState): SelectionClipShape {
  if (state.extent.kind === 'closure') return 'closure';
  return sameCursor(state.anchor, state.extent.cursor) ? 'point' : 'range';
}

function sequenceForMember(
  doc: MnxStructure,
  member: Extract<SelectionMember, { kind: 'note' | 'event' }>
): MnxSequence | undefined {
  return (doc.parts?.[member.partIndex]?.measures?.[member.measureIndex]?.sequences ?? [])
    .filter(sequence => (sequence.staff ?? 1) === member.staffIndex)[member.voiceIndex];
}

function eventForMember(
  doc: MnxStructure,
  member: Extract<SelectionMember, { kind: 'note' | 'event' }>
): MnxEvent | undefined {
  const item = sequenceForMember(doc, member)?.content?.[member.eventIndex];
  if (!item) return undefined;
  if (member.containerIndex === undefined) return isTimedEvent(item) ? item : undefined;
  return (item as { content?: MnxEvent[] }).content?.[member.containerIndex];
}

function measureIndices(members: SelectionMember[]): number[] {
  const indices = members.flatMap(member => {
    switch (member.kind) {
      case 'note':
      case 'event':
      case 'voiceMeasure':
      case 'partMeasure':
      case 'measure':
        return [member.measureIndex];
      case 'document':
        return [];
    }
  });
  if (indices.length === 0) return [];
  const start = Math.min(...indices);
  const end = Math.max(...indices);
  return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
}

function contextFor(doc: MnxStructure, indices: number[]): { measures: ClipMeasureContext[] } {
  // The effective meter per covered bar — inherited declarations included —
  // so paste can linearize source distances and flow across destination
  // barlines (core-paste-lands.md, D8). Absent only when nothing at or
  // before the bar declares one.
  const measures = doc.global?.measures ?? [];
  const effective: ({ count: number; unit: number } | undefined)[] = [];
  let current: { count: number; unit: number } | undefined;
  measures.forEach((measure, index) => {
    if (measure.time) current = { count: measure.time.count, unit: measure.time.unit };
    effective[index] = current;
  });
  return {
    measures: indices.map(index => {
      const global = measures[index];
      return cloneJson({
        ...(global?.id === undefined ? {} : { id: global.id }),
        ...(global?.key === undefined ? {} : { key: global.key }),
        ...(global?.time === undefined ? {} : { time: global.time }),
        ...(effective[index] === undefined ? {} : { effectiveTime: effective[index] })
      });
    })
  };
}

function partDescriptor(part: MnxPart): ClipPartDescriptor {
  const { measures: _measures, ...descriptor } = cloneJson(part);
  return descriptor;
}

function columnAt(doc: MnxStructure, measureIndex: number): MeasureClipColumn {
  return {
    global: cloneJson(doc.global?.measures?.[measureIndex] ?? {}),
    parts: (doc.parts ?? []).map(part =>
      cloneJson(part.measures?.[measureIndex] ?? { sequences: [] })
    )
  };
}

function keepScoped<T extends { staff?: number }>(
  entries: T[] | undefined,
  staffIndex: number
): T[] | undefined {
  const kept = entries?.filter(entry => (entry.staff ?? 1) === staffIndex);
  return kept && kept.length > 0 ? kept : undefined;
}

/** One staff's view of a part-measure — the voice-bars clip still narrows
 *  to its own staff's declarations, though the part-bars clip no longer
 *  filters (the member is the whole part's bar). */
function staffMeasure(source: MnxPartMeasure | undefined, staffIndex: number): MnxPartMeasure | null {
  if (!source) return null;
  const measure = cloneJson(source);
  measure.sequences = measure.sequences.filter(sequence => (sequence.staff ?? 1) === staffIndex);
  measure.clefs = keepScoped(measure.clefs, staffIndex);
  measure.dynamics = keepScoped(measure.dynamics, staffIndex);
  measure.directions = keepScoped(measure.directions, staffIndex);
  measure.ottavas = keepScoped(measure.ottavas, staffIndex);
  if (!measure.clefs) delete measure.clefs;
  if (!measure.dynamics) delete measure.dynamics;
  if (!measure.directions) delete measure.directions;
  if (!measure.ottavas) delete measure.ottavas;
  return measure;
}

function voiceDeclarations(
  source: MnxPartMeasure,
  staffIndex: number,
  voiceIndex: number,
  sequence: MnxSequence
): Omit<MnxPartMeasure, 'sequences'> | undefined {
  const measure = staffMeasure(source, staffIndex);
  if (!measure) return undefined;
  const declarationVoice = (entry: { voice?: string }): boolean =>
    entry.voice === undefined ? voiceIndex === 0 : entry.voice === sequence.voice;
  measure.dynamics = measure.dynamics?.filter(declarationVoice);
  measure.directions = measure.directions?.filter(declarationVoice);
  measure.ottavas = measure.ottavas?.filter(declarationVoice);
  if (!measure.dynamics?.length) delete measure.dynamics;
  if (!measure.directions?.length) delete measure.directions;
  if (!measure.ottavas?.length) delete measure.ottavas;
  delete measure.clefs; // a clef belongs to the staff, not one voice
  const { sequences: _sequences, ...declarations } = measure;
  return Object.keys(declarations).length > 0 ? declarations : undefined;
}

function eventItems(
  doc: MnxStructure,
  members: Extract<SelectionMember, { kind: 'event' }>[]
): SelectionClip | SelectionClipExtractionRefusal {
  const selectedChildren = new Map<string, Set<number>>();
  for (const member of members) {
    if (member.containerIndex === undefined) continue;
    const key = [
      member.partIndex,
      member.staffIndex,
      member.measureIndex,
      member.voiceIndex,
      member.eventIndex
    ].join(':');
    const set = selectedChildren.get(key) ?? new Set<number>();
    set.add(member.containerIndex);
    selectedChildren.set(key, set);
    const item = sequenceForMember(doc, member)?.content?.[member.eventIndex];
    const count = (item as { content?: MnxEvent[] } | undefined)?.content?.length ?? 0;
    if (count === 0) {
      return refuse('missing-source-member', 'The selected container no longer exists.');
    }
  }
  for (const [key, children] of selectedChildren) {
    const first = members.find(member => [
      member.partIndex,
      member.staffIndex,
      member.measureIndex,
      member.voiceIndex,
      member.eventIndex
    ].join(':') === key)!;
    const item = sequenceForMember(doc, first)?.content?.[first.eventIndex];
    const count = (item as { content?: MnxEvent[] } | undefined)?.content?.length ?? 0;
    if (children.size !== count) {
      return refuse(
        'partial-container',
        'The event range cuts through a tuplet, grace group or tremolo; select the whole container.'
      );
    }
  }

  const emitted: { member: typeof members[number]; item: MnxSequenceItem }[] = [];
  const emittedContainers = new Set<string>();
  for (const member of members) {
    const sequence = sequenceForMember(doc, member);
    const item = sequence?.content?.[member.eventIndex];
    if (!item) return refuse('missing-source-member', 'A selected event no longer exists.');
    if (member.containerIndex === undefined) {
      if (!isTimedEvent(item)) {
        return refuse('missing-source-member', 'A selected event no longer resolves to timed content.');
      }
      emitted.push({ member, item: cloneJson(item) });
      continue;
    }
    const key = [
      member.partIndex,
      member.staffIndex,
      member.measureIndex,
      member.voiceIndex,
      member.eventIndex
    ].join(':');
    if (!emittedContainers.has(key)) {
      emittedContainers.add(key);
      emitted.push({ member, item: cloneJson(item) });
    }
  }
  const start = Math.min(...emitted.map(entry => entry.member.measureIndex));
  const end = Math.max(...emitted.map(entry => entry.member.measureIndex));
  const bars = [...new Set(emitted.map(entry => entry.member.measureIndex))].map(measureIndex => {
    const entries = emitted.filter(entry => entry.member.measureIndex === measureIndex);
    const onset = entries[0].member.onset;
    return {
      offset: measureIndex - start,
      onset: [onset.num, onset.den] as [number, number],
      items: entries.map(entry => entry.item)
    };
  });
  return { kind: 'event-run', span: end - start + 1, bars };
}

function narrowRelationships(
  doc: MnxStructure,
  partIndex: number,
  staffIndex: number,
  indices: number[]
): ClipBarRelationships[] {
  const start = indices[0] ?? 0;
  return indices.flatMap(measureIndex => {
    const measure = doc.parts?.[partIndex]?.measures?.[measureIndex];
    if (!measure) return [];
    const beams = measure.beams ? cloneJson(measure.beams) : undefined;
    const ottavas = keepScoped(measure.ottavas, staffIndex);
    if (!beams?.length && !ottavas?.length) return [];
    return [{
      offset: measureIndex - start,
      ...(beams?.length ? { beams } : {}),
      ...(ottavas?.length ? { ottavas: cloneJson(ottavas) } : {})
    }];
  });
}

function buildClip(
  doc: MnxStructure,
  state: SelectionState,
  members: SelectionMember[]
): SelectionClip | SelectionClipExtractionRefusal {
  switch (state.level) {
    case 'note': {
      const notes: MnxNote[] = [];
      for (const member of members) {
        if (member.kind !== 'note') continue;
        const event = eventForMember(doc, member);
        const note = event?.notes?.[member.noteIndex];
        if (!event) return refuse('missing-source-member', 'A selected note no longer has an owning event.');
        if (!note) {
          return refuse(
            'unsupported-note-member',
            'This note kind is selectable but is not yet representable as a pitched note clip.'
          );
        }
        notes.push(cloneJson(note));
      }
      return { kind: 'note-set', notes };
    }
    case 'event':
      return eventItems(doc, members.filter(
        (member): member is Extract<SelectionMember, { kind: 'event' }> => member.kind === 'event'
      ));
    case 'voiceMeasure': {
      const voiceMembers = members.filter(
        (member): member is Extract<SelectionMember, { kind: 'voiceMeasure' }> =>
          member.kind === 'voiceMeasure'
      );
      const start = Math.min(...voiceMembers.map(member => member.measureIndex));
      const end = Math.max(...voiceMembers.map(member => member.measureIndex));
      const bars = voiceMembers.map(member => {
        const source = doc.parts?.[member.partIndex]?.measures?.[member.measureIndex];
        const sequence = source?.sequences?.[member.sequenceIndex];
        if (!source || !sequence) return null;
        const declarations = voiceDeclarations(
          source,
          member.staffIndex,
          member.voiceIndex,
          sequence
        );
        return {
          offset: member.measureIndex - start,
          sequence: cloneJson(sequence),
          ...(declarations ? { declarations } : {})
        };
      });
      if (bars.some(bar => bar === null)) {
        return refuse('missing-source-member', 'A selected voice bar no longer exists.');
      }
      return { kind: 'voice-bars', span: end - start + 1, bars: bars.filter(bar => bar !== null) };
    }
    case 'partMeasure': {
      const partIndex = state.anchor.partIndex ?? 0;
      if (state.extent.kind === 'closure') {
        const part = doc.parts?.[partIndex];
        return part
          ? { kind: 'part', part: cloneJson(part) }
          : refuse('missing-source-member', 'The selected part no longer exists.');
      }
      const barMembers = members.filter(
        (member): member is Extract<SelectionMember, { kind: 'partMeasure' }> =>
          member.kind === 'partMeasure'
      );
      const start = Math.min(...barMembers.map(member => member.measureIndex));
      const end = Math.max(...barMembers.map(member => member.measureIndex));
      const bars = barMembers.flatMap(member => {
        const measure = doc.parts?.[member.partIndex]?.measures?.[member.measureIndex];
        return measure ? [{ offset: member.measureIndex - start, measure: cloneJson(measure) }] : [];
      });
      return { kind: 'part-bars', span: end - start + 1, bars };
    }
    case 'measure': {
      const indices = members.flatMap(member => member.kind === 'measure' ? [member.measureIndex] : []);
      return {
        kind: 'measures',
        parts: (doc.parts ?? []).map(partDescriptor),
        measures: indices.map(index => columnAt(doc, index))
      };
    }
    case 'document':
      return { kind: 'document', document: cloneJson(doc) };
  }
}

function visitItems(items: MnxSequenceItem[], visit: (event: MnxEvent) => void): void {
  for (const item of items) {
    if (isTimedEvent(item)) visit(item);
    else visitItems((item as { content?: MnxSequenceItem[] }).content ?? [], visit);
  }
}

function clipEvents(envelope: SelectionClipEnvelope): MnxEvent[] {
  const events: MnxEvent[] = [];
  const visitMeasure = (measure: MnxPartMeasure): void => {
    for (const sequence of measure.sequences ?? []) visitItems(sequence.content, event => events.push(event));
  };
  const visitPart = (part: MnxPart): void => (part.measures ?? []).forEach(visitMeasure);
  const clip = envelope.clip;
  switch (clip.kind) {
    case 'note-set':
      return [];
    case 'event-run':
      clip.bars.forEach(bar => visitItems(bar.items, event => events.push(event)));
      break;
    case 'voice-bars':
      clip.bars.forEach(bar => visitItems(bar.sequence.content, event => events.push(event)));
      break;
    case 'part-bars':
      clip.bars.forEach(bar => visitMeasure(bar.measure));
      break;
    case 'part':
      visitPart(clip.part);
      break;
    case 'measures':
      clip.measures.forEach(column => column.parts.forEach(visitMeasure));
      break;
    case 'document':
      clip.document.parts.forEach(visitPart);
      break;
  }
  return events;
}

type RelationshipHolder = { beams?: MnxBeam[]; ottavas?: MnxOttava[] };

function relationshipHolders(envelope: SelectionClipEnvelope): RelationshipHolder[] {
  const holders: RelationshipHolder[] = [];
  const addMeasure = (measure: MnxPartMeasure): void => { holders.push(measure); };
  const addPart = (part: MnxPart): void => (part.measures ?? []).forEach(addMeasure);
  const clip = envelope.clip;
  switch (clip.kind) {
    case 'voice-bars':
      clip.bars.forEach(bar => { if (bar.declarations) holders.push(bar.declarations); });
      break;
    case 'part-bars':
      clip.bars.forEach(bar => addMeasure(bar.measure));
      break;
    case 'part':
      addPart(clip.part);
      break;
    case 'measures':
      clip.measures.forEach(column => column.parts.forEach(addMeasure));
      break;
    case 'document':
      clip.document.parts.forEach(addPart);
      break;
    default:
      break;
  }
  holders.push(...(envelope.relationships?.measures ?? []));
  return holders;
}

function cleanupTechnique(note: MnxNote): void {
  const mnxLab = note._x?.mnxLab;
  const tab = mnxLab?.tab;
  if (tab?.technique && Object.keys(tab.technique).length === 0) delete tab.technique;
  if (tab && Object.keys(tab).length === 0) delete mnxLab!.tab;
  if (mnxLab && Object.keys(mnxLab).length === 0) delete note._x!.mnxLab;
  if (note._x && Object.keys(note._x).length === 0) delete note._x;
}

function closeReferences(envelope: SelectionClipEnvelope): DetachedSelectionReference[] {
  const detached: DetachedSelectionReference[] = [];
  const events = clipEvents(envelope);
  const notes = envelope.clip.kind === 'note-set'
    ? envelope.clip.notes
    : events.flatMap(event => event.notes ?? []);
  const noteIds = new Set(notes.flatMap(note => note.id === undefined ? [] : [note.id]));
  const eventIds = new Set(events.flatMap(event => event.id === undefined ? [] : [event.id]));
  const measureIds = new Set<string>();
  const addMeasureIds = (contexts: ClipMeasureContext[] | undefined): void => {
    contexts?.forEach(context => { if (context.id !== undefined) measureIds.add(context.id); });
  };
  addMeasureIds(envelope.context?.measures);
  const addGlobal = (global: { id?: string }): void => { if (global.id !== undefined) measureIds.add(global.id); };
  if (envelope.clip.kind === 'measures') envelope.clip.measures.forEach(column => addGlobal(column.global));
  if (envelope.clip.kind === 'document') envelope.clip.document.global.measures.forEach(addGlobal);

  for (const note of notes) {
    if (note.ties) {
      note.ties = note.ties.filter(tie => {
        if (tie.target === undefined || noteIds.has(tie.target)) return true;
        detached.push({ kind: 'tie', target: tie.target });
        return false;
      });
      if (note.ties.length === 0) delete note.ties;
    }
    const technique = note._x?.mnxLab?.tab?.technique as
      | Record<string, { target?: string } | boolean | undefined>
      | undefined;
    if (technique) {
      for (const [kind, value] of Object.entries(technique)) {
        if (!value || typeof value !== 'object' || value.target === undefined) continue;
        if (!noteIds.has(value.target)) {
          detached.push({ kind: 'technique', target: value.target });
          delete technique[kind];
        }
      }
      cleanupTechnique(note);
    }
  }

  for (const event of events) {
    if (!event.slurs) continue;
    event.slurs = event.slurs.filter(slur => {
      const missing = [
        !eventIds.has(slur.target) ? slur.target : null,
        slur.startNote !== undefined && !noteIds.has(slur.startNote) ? slur.startNote : null,
        slur.endNote !== undefined && !noteIds.has(slur.endNote) ? slur.endNote : null
      ].filter((target): target is string => target !== null);
      missing.forEach(target => detached.push({ kind: 'slur', target }));
      return missing.length === 0;
    });
    if (event.slurs.length === 0) delete event.slurs;
  }

  const closeBeams = (beams: MnxBeam[]): MnxBeam[] => beams.filter(beam => {
    const missing = beam.events.filter(id => !eventIds.has(id));
    missing.forEach(target => detached.push({ kind: 'beam', target }));
    if (missing.length > 0) return false;
    if (beam.beams) {
      beam.beams = closeBeams(beam.beams);
      if (beam.beams.length === 0) delete beam.beams;
    }
    return true;
  });

  for (const holder of relationshipHolders(envelope)) {
    if (holder.beams) {
      holder.beams = closeBeams(holder.beams);
      if (holder.beams.length === 0) delete holder.beams;
    }
    if (holder.ottavas) {
      holder.ottavas = holder.ottavas.filter(ottava => {
        if (measureIds.has(ottava.end.measure)) return true;
        detached.push({ kind: 'ottava', target: ottava.end.measure });
        return false;
      });
      if (holder.ottavas.length === 0) delete holder.ottavas;
    }
  }

  if (envelope.relationships) {
    envelope.relationships.measures = envelope.relationships.measures.filter(measure =>
      (measure.beams?.length ?? 0) > 0 || (measure.ottavas?.length ?? 0) > 0
    );
    if (envelope.relationships.measures.length === 0) delete envelope.relationships;
  }
  return detached;
}

function dependenciesFor(
  doc: MnxStructure,
  envelope: SelectionClipEnvelope
): SelectionClipDependencies | undefined {
  if (envelope.clip.kind === 'document') return undefined;
  const events = clipEvents(envelope);
  const usedLines: string[] = [];
  for (const event of events) {
    for (const line of Object.keys(event.lyrics?.lines ?? {})) {
      if (!usedLines.includes(line)) usedLines.push(line);
    }
  }
  const sourceLyrics = doc.global?.lyrics;
  const orderedLines = [
    ...(sourceLyrics?.lineOrder ?? []).filter(line => usedLines.includes(line)),
    ...usedLines.filter(line => !(sourceLyrics?.lineOrder ?? []).includes(line))
  ];
  const lineMetadata = Object.fromEntries(
    orderedLines.flatMap(line => sourceLyrics?.lineMetadata?.[line]
      ? [[line, cloneJson(sourceLyrics.lineMetadata[line])]]
      : [])
  );
  const lyrics = usedLines.length > 0
    ? {
        lineOrder: orderedLines,
        ...(Object.keys(lineMetadata).length > 0 ? { lineMetadata } : {})
      }
    : undefined;
  const support = doc.mnx.support ? cloneJson(doc.mnx.support) : undefined;
  return support || lyrics ? { ...(support ? { support } : {}), ...(lyrics ? { lyrics } : {}) } : undefined;
}

/** Materialize a live point/range/closure as one detached serialized clip. */
export function extractSelectionClip(
  doc: MnxStructure,
  state: SelectionState,
  projection: Projection
): SelectionClipExtractionResult {
  const resolved = resolveSelection(doc, state, projection);
  if (resolved.members.length === 0) {
    return refuse('empty-selection', 'The current selection has no material to copy.');
  }
  const clip = buildClip(doc, state, resolved.members);
  if (isRefusal(clip)) return clip;
  const indices = measureIndices(resolved.members);
  const envelope: SelectionClipEnvelope = {
    format: SELECTION_CLIP_FORMAT,
    version: SELECTION_CLIP_VERSION,
    source: {
      mnxVersion: doc.mnx.version,
      extensionVersion: MNX_LAB_EXTENSION_VERSION
    },
    selection: { level: state.level, shape: selectionShape(state) },
    clip,
    ...(state.level === 'measure' || state.level === 'document'
      ? {}
      : { context: contextFor(doc, indices) })
  };
  if (state.level === 'event') {
    const relationships = narrowRelationships(
      doc,
      state.anchor.partIndex ?? 0,
      state.anchor.staffIndex ?? 1,
      indices
    );
    if (relationships.length > 0) envelope.relationships = { measures: relationships };
  }
  const detached = closeReferences(envelope);
  const dependencies = dependenciesFor(doc, envelope);
  if (dependencies) envelope.dependencies = dependencies;
  const serialized = encodeSelectionClip(envelope);
  return {
    ok: true,
    serialized,
    envelope: decodeSelectionClip(serialized),
    detached
  };
}
