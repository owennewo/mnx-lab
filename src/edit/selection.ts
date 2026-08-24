// The selection ladder — roadmap/complete/core-selection-ladder.md.
//
// Input modes ARE the selection level: every selection sits on one rung of the
// document's containment chain, and the options offered at the cursor are that
// rung's properties and nothing else. This module is the DOM-free core —
// levels, the presence rule, the relax/tighten walk, and the note-key
// footprint each level paints (the existing overlay currency).
//
// The PRESENCE RULE: selection addresses what IS. A rung the document doesn't
// have at the cursor (no note under a rest, no section labels anywhere) is
// skipped by relax/tighten — never offered empty. The input cursor may still
// address what COULD be (entry ghosts); that is cursor state, not selection.
//
// The BREADCRUMB is implicit: relaxing never moves the cursor, so its
// measure/onset/line survive as the relative address tighten re-resolves —
// "voice 2, this beat, this string" against wherever the cursor now stands,
// exactly the corresponding-child descent the roadmap doc asks for. No
// absolute ids are stored, so descending after lateral movement lands in the
// current bar, never teleports back.
//
// 'part' is DELIBERATELY not a rung: the ladder is the vertical axis, and the
// part is the horizontal CLOSURE of part-measure (Ctrl+A), per the roadmap doc.
import type { MnxSequence, MnxSequenceItem, MnxStructure } from '../model/mnx.ts';
import { isTimedEvent } from '../model/mnx.ts';
import { forEachNoteAddress } from '../model/noteWalk.ts';
import { kitNoteKey } from '../model/noteKeys.ts';
import {
  buildGrid,
  addOnsets,
  eventSlotAt,
  itemSpan,
  onsetsEqual,
  slotAt,
  type EditorCursor,
  type Onset,
  type PositionGrid,
  type Projection
} from './cursor.ts';

/** Bottom to top. 'section' exists only when the document declares section
 *  labels (a proposed-schema field — spec-loop evidence, see the roadmap doc). */
export type SelectionLevel =
  | 'note'
  | 'event'
  | 'container'
  | 'voiceMeasure'
  | 'partMeasure'
  | 'measure'
  | 'section'
  | 'document';

export const SELECTION_LADDER: readonly SelectionLevel[] = [
  'note',
  'event',
  'container',
  'voiceMeasure',
  'partMeasure',
  'measure',
  'section',
  'document'
];

export type SelectionClosureScope = 'voice' | 'part' | 'timeline' | 'document';

/** The durable selection state. Concrete ranges carry two cursor addresses;
 * closures carry their live model scope instead of freezing today's last
 * member. The ordinary session cursor is the active edge. */
export interface SelectionState {
  level: SelectionLevel;
  anchor: EditorCursor;
  extent:
    | { kind: 'cursor'; cursor: EditorCursor }
    | { kind: 'closure'; scope: SelectionClosureScope };
}

/** A selected thing at the current rung. These are model addresses, not
 * renderer geometry. In particular, rest events and empty bar copies remain
 * real members even though they contribute no note key to the ink overlay. */
export type SelectionMember =
  | {
      kind: 'note';
      partIndex: number;
      staffIndex: number;
      measureIndex: number;
      onset: Onset;
      voiceIndex: number;
      eventIndex: number;
      containerIndex?: number;
      noteIndex: number;
      noteKey: string;
    }
  | {
      kind: 'event';
      partIndex: number;
      staffIndex: number;
      measureIndex: number;
      onset: Onset;
      voiceIndex: number;
      eventIndex: number;
      containerIndex?: number;
    }
  | {
      kind: 'container';
      partIndex: number;
      staffIndex: number;
      measureIndex: number;
      onset: Onset;
      voiceIndex: number;
      /** Raw sequence index and content index: the owning container object. */
      sequenceIndex: number;
      eventIndex: number;
      containerType: 'tuplet' | 'grace' | 'tremolo';
    }
  | {
      kind: 'voiceMeasure';
      partIndex: number;
      staffIndex: number;
      measureIndex: number;
      voiceIndex: number;
      sequenceIndex: number;
    }
  | { kind: 'partMeasure'; partIndex: number; staffIndex: number; measureIndex: number }
  | { kind: 'measure'; measureIndex: number }
  | { kind: 'section'; start: number; end: number }
  | { kind: 'document' };

export interface ResolvedSelection {
  /** Ordered in document/time order, regardless of drag direction. */
  members: SelectionMember[];
  /** Canonical renderer/edit keys covered by those members. */
  noteKeys: string[];
}

/** The only valid closure for each rung. Kept separate from gesture code so
 * traces, commands and future mouse input share the same scope contract. */
export function closureScopeForLevel(level: SelectionLevel): SelectionClosureScope {
  switch (level) {
    case 'note':
    case 'event':
    case 'container':
    case 'voiceMeasure':
      return 'voice';
    case 'partMeasure':
      return 'part';
    case 'measure':
    case 'section':
      return 'timeline';
    case 'document':
      return 'document';
  }
}

export function pointSelection(level: SelectionLevel, cursor: EditorCursor): SelectionState {
  const anchor = copyCursor(cursor);
  return { level, anchor, extent: { kind: 'cursor', cursor: copyCursor(cursor) } };
}

/** The cursor's staff filter, restated from the layouts (see cursor.ts header):
 *  one staff at a time, and its sequences numbered per staff — the same
 *  counting `buildGrid` does, so a voice index means the same thing in both. */
function staffSequences(
  sequences: MnxSequence[] | undefined,
  staffIndex: number
): MnxSequence[] {
  return (sequences ?? []).filter(seq => (seq.staff ?? 1) === staffIndex);
}

/** The part the selection reads. The cursor addresses one part at a time
 *  (campaign item 13b) and the part-measure rung's ↑↓ now WALKS parts, so a
 *  footprint pinned to `parts[0]` would paint another part's bar than the one
 *  the cursor is in — visible the moment a bare arrow can cross the boundary. */
function partMeasures(doc: MnxStructure, cursor: EditorCursor) {
  return doc.parts?.[cursor.partIndex ?? 0]?.measures ?? [];
}

/**
 * The voice the selection anchors to — THE CURSOR'S, absent meaning the first.
 *
 * This used to read the voice off the ink under the cursor, which was the same
 * mistake the ink walk made and was corrected for: a voice re-derived per read
 * is a voice that changes when you step off ink. At event level it showed:
 * moving down past voice 1's note left the cursor carrying voice 1 while the
 * slice silently repainted voice 0's event, because empty space has no ink to
 * derive from. The cursor holds the voice through every move (`carry`), so the
 * selection reads it there and the two can no longer disagree.
 */
export function anchorVoiceIndex(cursor: EditorCursor): number {
  return cursor.voiceIndex ?? 0;
}

/** Measure indices where a section label sits (proposed `global.measure.section`). */
export function sectionStarts(doc: MnxStructure): number[] {
  const starts: number[] = [];
  (doc.global?.measures ?? []).forEach((measure, index) => {
    if (measure.section) starts.push(index);
  });
  return starts;
}

/** Measure range of the section containing `measureIndex`, end-exclusive.
 *  A section extends until the next label; measures before the first label
 *  belong to no section (the rung is absent there — presence rule). */
export function sectionRangeAt(
  doc: MnxStructure,
  measureIndex: number
): { start: number; end: number } | null {
  const starts = sectionStarts(doc);
  let start = -1;
  for (const s of starts) {
    if (s <= measureIndex) start = s;
    else break;
  }
  if (start < 0) return null;
  const next = starts.find(s => s > start);
  const measureCount = Math.max(
    doc.global?.measures?.length ?? 0,
    ...(doc.parts ?? []).map(part => part.measures?.length ?? 0)
  );
  return { start, end: next ?? measureCount };
}

/** Which rungs exist at this cursor — the presence rule, computed fresh so a
 *  document edit can never leave a stale rung reachable. */
export function presentLevels(
  doc: MnxStructure,
  grid: PositionGrid,
  cursor: EditorCursor,
  projection: Projection
): Set<SelectionLevel> {
  const present = new Set<SelectionLevel>(['partMeasure', 'measure', 'document']);
  const sequences = staffSequences(
    partMeasures(doc, cursor)[cursor.measureIndex]?.sequences,
    cursor.staffIndex ?? 1
  );
  if (sequences.length > 0) present.add('voiceMeasure');
  if (eventSlotAt(grid, cursor, projection)) present.add('event');
  if (eventSlotAt(grid, cursor, projection)?.containerIndex !== undefined) present.add('container');
  if (slotAt(grid, cursor, projection)) present.add('note');
  if (sectionRangeAt(doc, cursor.measureIndex)) present.add('section');
  return present;
}

/** One rung up, skipping absent rungs; null at the top (the mount turns that
 *  into the conventional deselect — Escape never changes meaning, it just
 *  becomes gradual). */
export function relaxLevel(
  present: ReadonlySet<SelectionLevel>,
  from: SelectionLevel
): SelectionLevel | null {
  for (let i = SELECTION_LADDER.indexOf(from) + 1; i < SELECTION_LADDER.length; i++) {
    if (present.has(SELECTION_LADDER[i])) return SELECTION_LADDER[i];
  }
  return null;
}

/** One rung down, skipping absent rungs; null at the bottom (where Enter's
 *  future job is to begin input, not to select deeper). */
export function tightenLevel(
  present: ReadonlySet<SelectionLevel>,
  from: SelectionLevel
): SelectionLevel | null {
  for (let i = SELECTION_LADDER.indexOf(from) - 1; i >= 0; i--) {
    if (present.has(SELECTION_LADDER[i])) return SELECTION_LADDER[i];
  }
  return null;
}

function copyCursor(cursor: EditorCursor): EditorCursor {
  return { ...cursor, onset: { ...cursor.onset } };
}

function documentMeasureCount(doc: MnxStructure): number {
  return Math.max(
    doc.global?.measures?.length ?? 0,
    ...(doc.parts ?? []).map(part => part.measures?.length ?? 0)
  );
}

function noteMembers(doc: MnxStructure, cursor: EditorCursor): SelectionMember[] {
  const partIndex = cursor.partIndex ?? 0;
  const staffIndex = cursor.staffIndex ?? 1;
  const voiceIndex = anchorVoiceIndex(cursor);
  const grid = buildGrid(doc, partIndex, staffIndex);
  return grid.positions.flatMap(position =>
    position.slots
      .filter(slot => slot.voiceIndex === voiceIndex)
      .map(slot => ({
        kind: 'note' as const,
        partIndex,
        staffIndex,
        measureIndex: position.measureIndex,
        onset: { ...position.onset },
        voiceIndex,
        eventIndex: slot.eventIndex,
        ...(slot.containerIndex === undefined ? {} : { containerIndex: slot.containerIndex }),
        noteIndex: slot.noteIndex,
        noteKey: slot.noteKey
      }))
  );
}

function eventMembers(doc: MnxStructure, cursor: EditorCursor): SelectionMember[] {
  const partIndex = cursor.partIndex ?? 0;
  const staffIndex = cursor.staffIndex ?? 1;
  const voiceIndex = anchorVoiceIndex(cursor);
  const grid = buildGrid(doc, partIndex, staffIndex);
  return grid.positions.flatMap(position =>
    position.events
      .filter(event => event.voiceIndex === voiceIndex)
      .map(event => ({
        kind: 'event' as const,
        partIndex,
        staffIndex,
        measureIndex: position.measureIndex,
        onset: { ...position.onset },
        voiceIndex,
        eventIndex: event.eventIndex,
        ...(event.containerIndex === undefined ? {} : { containerIndex: event.containerIndex })
      }))
  );
}

function containerType(item: MnxSequenceItem): 'tuplet' | 'grace' | 'tremolo' | null {
  const type = (item as { type?: string }).type;
  return type === 'tuplet' || type === 'grace' || type === 'tremolo' ? type : null;
}

/** Containers in the active part/staff/voice timeline. Their top-level
 * content index is already carried by every inner EventSlot; enumeration here
 * adds the raw sequence index needed by the guarded removal op. */
function containerMembers(doc: MnxStructure, cursor: EditorCursor): SelectionMember[] {
  const partIndex = cursor.partIndex ?? 0;
  const staffIndex = cursor.staffIndex ?? 1;
  const voiceIndex = anchorVoiceIndex(cursor);
  const members: SelectionMember[] = [];
  (doc.parts?.[partIndex]?.measures ?? []).forEach((measure, measureIndex) => {
    const voiceByStaff = new Map<number, number>();
    (measure.sequences ?? []).forEach((sequence, sequenceIndex) => {
      const sequenceStaff = sequence.staff ?? 1;
      const sequenceVoice = (voiceByStaff.get(sequenceStaff) ?? -1) + 1;
      voiceByStaff.set(sequenceStaff, sequenceVoice);
      if (sequenceStaff !== staffIndex || sequenceVoice !== voiceIndex) return;
      let onset: Onset = { num: 0, den: 1 };
      sequence.content.forEach((item, eventIndex) => {
        const type = containerType(item);
        if (type) {
          members.push({
            kind: 'container',
            partIndex,
            staffIndex,
            measureIndex,
            onset: { ...onset },
            voiceIndex,
            sequenceIndex,
            eventIndex,
            containerType: type
          });
        }
        onset = addOnsets(onset, itemSpan(item));
      });
    });
  });
  return members;
}

function voiceMeasureMembers(doc: MnxStructure, cursor: EditorCursor): SelectionMember[] {
  const partIndex = cursor.partIndex ?? 0;
  const staffIndex = cursor.staffIndex ?? 1;
  const voiceIndex = anchorVoiceIndex(cursor);
  const members: SelectionMember[] = [];
  (doc.parts?.[partIndex]?.measures ?? []).forEach((measure, measureIndex) => {
    const sequenceIndex = (measure.sequences ?? [])
      .map((sequence, index) => ({ sequence, index }))
      .filter(entry => (entry.sequence.staff ?? 1) === staffIndex)[voiceIndex]?.index;
    if (sequenceIndex !== undefined)
      members.push({
        kind: 'voiceMeasure',
        partIndex,
        staffIndex,
        measureIndex,
        voiceIndex,
        sequenceIndex
      });
  });
  return members;
}

function partMeasureMembers(
  doc: MnxStructure,
  cursor: EditorCursor,
  wholePart: boolean
): SelectionMember[] {
  const partIndex = cursor.partIndex ?? 0;
  const part = doc.parts?.[partIndex];
  if (!part) return [];
  const measureCount = Math.max(doc.global?.measures?.length ?? 0, part.measures?.length ?? 0);
  const staves = wholePart
    ? Array.from({ length: Math.max(1, part.staves ?? 1) }, (_, index) => index + 1)
    : [cursor.staffIndex ?? 1];
  return staves.flatMap(staffIndex =>
    Array.from({ length: measureCount }, (_, measureIndex) => ({
      kind: 'partMeasure' as const,
      partIndex,
      staffIndex,
      measureIndex
    }))
  );
}

function measureMembers(doc: MnxStructure): SelectionMember[] {
  return Array.from({ length: documentMeasureCount(doc) }, (_, measureIndex) => ({
    kind: 'measure' as const,
    measureIndex
  }));
}

function sectionMembers(doc: MnxStructure): SelectionMember[] {
  return sectionStarts(doc).map(start => {
    const range = sectionRangeAt(doc, start);
    return { kind: 'section' as const, start, end: range?.end ?? start + 1 };
  });
}

function universeFor(
  doc: MnxStructure,
  state: SelectionState,
  closure: boolean
): SelectionMember[] {
  switch (state.level) {
    case 'note':
      return noteMembers(doc, state.anchor);
    case 'event':
      return eventMembers(doc, state.anchor);
    case 'container':
      return containerMembers(doc, state.anchor);
    case 'voiceMeasure':
      return voiceMeasureMembers(doc, state.anchor);
    case 'partMeasure':
      return partMeasureMembers(doc, state.anchor, closure);
    case 'measure':
      return measureMembers(doc);
    case 'section':
      return sectionMembers(doc);
    case 'document':
      return [{ kind: 'document' }];
  }
}

function memberMeasure(member: SelectionMember): number | null {
  switch (member.kind) {
    case 'note':
    case 'event':
    case 'container':
    case 'voiceMeasure':
    case 'partMeasure':
    case 'measure':
      return member.measureIndex;
    case 'section':
      return member.start;
    case 'document':
      return null;
  }
}

function exactMemberIndex(
  doc: MnxStructure,
  members: SelectionMember[],
  cursor: EditorCursor,
  level: SelectionLevel,
  projection: Projection
): number {
  const partIndex = cursor.partIndex ?? 0;
  const staffIndex = cursor.staffIndex ?? 1;
  const voiceIndex = anchorVoiceIndex(cursor);
  const grid = buildGrid(doc, partIndex, staffIndex);
  switch (level) {
    case 'note': {
      const slot = slotAt(grid, cursor, projection);
      return members.findIndex(member => member.kind === 'note' && member.noteKey === slot?.noteKey);
    }
    case 'event': {
      const event = eventSlotAt(grid, cursor, projection);
      return members.findIndex(member =>
        member.kind === 'event' &&
        member.partIndex === partIndex &&
        member.staffIndex === staffIndex &&
        member.measureIndex === cursor.measureIndex &&
        member.voiceIndex === event?.voiceIndex &&
        member.eventIndex === event?.eventIndex &&
        member.containerIndex === event?.containerIndex
      );
    }
    case 'container': {
      const event = eventSlotAt(grid, cursor, projection);
      return members.findIndex(member =>
        member.kind === 'container' &&
        member.partIndex === partIndex &&
        member.staffIndex === staffIndex &&
        member.measureIndex === cursor.measureIndex &&
        member.voiceIndex === event?.voiceIndex &&
        member.eventIndex === event?.eventIndex &&
        event?.containerIndex !== undefined
      );
    }
    case 'voiceMeasure':
      return members.findIndex(member =>
        member.kind === 'voiceMeasure' &&
        member.partIndex === partIndex &&
        member.staffIndex === staffIndex &&
        member.measureIndex === cursor.measureIndex &&
        member.voiceIndex === voiceIndex
      );
    case 'partMeasure':
      return members.findIndex(member =>
        member.kind === 'partMeasure' &&
        member.partIndex === partIndex &&
        member.staffIndex === staffIndex &&
        member.measureIndex === cursor.measureIndex
      );
    case 'measure':
      return members.findIndex(member => member.kind === 'measure' && member.measureIndex === cursor.measureIndex);
    case 'section':
      return members.findIndex(member =>
        member.kind === 'section' && cursor.measureIndex >= member.start && cursor.measureIndex < member.end
      );
    case 'document':
      return members.findIndex(member => member.kind === 'document');
  }
}

/** Resolve a removed endpoint by the cursor clamp rule: the last survivor in
 * its bar, otherwise the nearest surviving edge of the ordered universe. */
function endpointIndex(
  doc: MnxStructure,
  members: SelectionMember[],
  cursor: EditorCursor,
  level: SelectionLevel,
  projection: Projection
): number {
  const exact = exactMemberIndex(doc, members, cursor, level, projection);
  if (exact >= 0) return exact;
  const sameMeasure = members
    .map((member, index) => ({ index, measure: memberMeasure(member) }))
    .filter(item => item.measure === cursor.measureIndex);
  if (sameMeasure.length > 0) return sameMeasure[sameMeasure.length - 1].index;
  const after = members.findIndex(member => {
    const measure = memberMeasure(member);
    return measure !== null && measure > cursor.measureIndex;
  });
  return after === 0 ? 0 : after > 0 ? after - 1 : members.length - 1;
}

function sameCursor(a: EditorCursor, b: EditorCursor): boolean {
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

interface InkAddress {
  key: string;
  partIndex: number;
  staffIndex: number;
  measureIndex: number;
  voiceIndex: number;
  eventIndex: number;
  containerIndex?: number;
}

function inkAddresses(doc: MnxStructure): InkAddress[] {
  const addresses: InkAddress[] = [];
  forEachNoteAddress(doc, address => {
    addresses.push({
      key: address.key,
      partIndex: address.partIndex,
      staffIndex: address.staffIndex,
      measureIndex: address.measureIndex,
      voiceIndex: address.voiceIndex,
      eventIndex: address.eventIndex,
      ...(address.containerIndex === undefined ? {} : { containerIndex: address.containerIndex })
    });
  });
  // Percussion notes sit beside pitched `notes`, outside the canonical pitched
  // walk, but use the same structural event address and overlay-key currency.
  (doc.parts ?? []).forEach((part, partIndex) => {
    (part.measures ?? []).forEach((measure, measureIndex) => {
      const voiceByStaff = new Map<number, number>();
      (measure.sequences ?? []).forEach(sequence => {
        const staffIndex = sequence.staff ?? 1;
        const voiceIndex = (voiceByStaff.get(staffIndex) ?? -1) + 1;
        voiceByStaff.set(staffIndex, voiceIndex);
        sequence.content.forEach((item, eventIndex) => {
          if (!isTimedEvent(item)) return;
          const kitNotes = (item as { kitNotes?: unknown[] }).kitNotes ?? [];
          kitNotes.forEach((_, kitIndex) => addresses.push({
            key: kitNoteKey(measureIndex, voiceIndex, eventIndex, kitIndex, partIndex),
            partIndex,
            staffIndex,
            measureIndex,
            voiceIndex,
            eventIndex
          }));
        });
      });
    });
  });
  return addresses;
}

function memberContainsInk(member: SelectionMember, address: InkAddress): boolean {
  switch (member.kind) {
    case 'note':
      return member.noteKey === address.key;
    case 'event':
      return (
        member.partIndex === address.partIndex &&
        member.staffIndex === address.staffIndex &&
        member.measureIndex === address.measureIndex &&
        member.voiceIndex === address.voiceIndex &&
        member.eventIndex === address.eventIndex &&
        member.containerIndex === address.containerIndex
      );
    case 'container':
      return (
        member.partIndex === address.partIndex &&
        member.staffIndex === address.staffIndex &&
        member.measureIndex === address.measureIndex &&
        member.voiceIndex === address.voiceIndex &&
        member.eventIndex === address.eventIndex &&
        address.containerIndex !== undefined
      );
    case 'voiceMeasure':
      return (
        member.partIndex === address.partIndex &&
        member.staffIndex === address.staffIndex &&
        member.measureIndex === address.measureIndex &&
        member.voiceIndex === address.voiceIndex
      );
    case 'partMeasure':
      return (
        member.partIndex === address.partIndex &&
        member.staffIndex === address.staffIndex &&
        member.measureIndex === address.measureIndex
      );
    case 'measure':
      return member.measureIndex === address.measureIndex;
    case 'section':
      return address.measureIndex >= member.start && address.measureIndex < member.end;
    case 'document':
      return true;
  }
}

/** Resolve a point, ordered interval or live closure against the current
 * document. No ids or member arrays are stored in session state, so edits
 * cannot leave a selection claiming objects that no longer exist. */
export function resolveSelection(
  doc: MnxStructure,
  state: SelectionState,
  projection: Projection
): ResolvedSelection {
  let members: SelectionMember[];
  if (state.extent.kind === 'closure') {
    if (state.extent.scope !== closureScopeForLevel(state.level)) {
      return { members: [], noteKeys: [] };
    }
    const universe = universeFor(doc, state, true);
    members = universe;
  } else {
    const universe = universeFor(doc, state, false);
    if (universe.length === 0) return { members: [], noteKeys: [] };
    // A collapsed point on an absent rung stays empty; it does not borrow a
    // neighbouring note. Endpoint fallback is for a real range surviving a
    // document edit, where preserving the remaining interval is honest.
    const point = sameCursor(state.anchor, state.extent.cursor);
    const pointIndex = point
      ? exactMemberIndex(doc, universe, state.anchor, state.level, projection)
      : -1;
    if (point && pointIndex < 0) {
      members = [];
    } else {
      const anchor = pointIndex >= 0
        ? pointIndex
        : endpointIndex(doc, universe, state.anchor, state.level, projection);
      const extent = pointIndex >= 0
        ? pointIndex
        : endpointIndex(doc, universe, state.extent.cursor, state.level, projection);
      members = universe.slice(Math.min(anchor, extent), Math.max(anchor, extent) + 1);
    }
  }
  const ink = inkAddresses(doc);
  const noteKeys = ink
    .filter(address => members.some(member => memberContainsInk(member, address)))
    .map(address => address.key);
  return { members, noteKeys: [...new Set(noteKeys)] };
}

/** Compatibility surface for the existing overlay callers. New range-aware
 * consumers should retain the full `ResolvedSelection`, including structural
 * members for rests and empty bar copies. */
export function selectionNoteKeys(
  doc: MnxStructure,
  _grid: PositionGrid,
  cursor: EditorCursor,
  level: SelectionLevel,
  projection: Projection
): string[] {
  return resolveSelection(doc, pointSelection(level, cursor), projection).noteKeys;
}
