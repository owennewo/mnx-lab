// The selection ladder — roadmap/inprogress/core-selection-ladder.md.
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
// Rungs not yet modelled: 'container' (tuplet/grace/tremolo). The cursor and
// footprint DO descend into containers; the ladder currently walks directly
// from their inner event to voice-measure until the container rung lands.
// 'part' is DELIBERATELY not a rung: the ladder is the vertical axis, and the
// part is the horizontal CLOSURE of part-measure (Ctrl+A), per the roadmap doc.
import type { MnxSequence, MnxStructure } from '../model/mnx.ts';
import { isTimedEvent } from '../model/mnx.ts';
import { forEachNoteAddress } from '../model/noteWalk.ts';
import { kitNoteKey } from '../model/noteKeys.ts';
import {
  eventSlotAt,
  slotAt,
  type EditorCursor,
  type PositionGrid,
  type Projection
} from './cursor.ts';

/** Bottom to top. 'section' exists only when the document declares section
 *  labels (a proposed-schema field — spec-loop evidence, see the roadmap doc). */
export type SelectionLevel =
  | 'note'
  | 'event'
  | 'voiceMeasure'
  | 'partMeasure'
  | 'measure'
  | 'section'
  | 'score';

export const SELECTION_LADDER: readonly SelectionLevel[] = [
  'note',
  'event',
  'voiceMeasure',
  'partMeasure',
  'measure',
  'section',
  'score'
];

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
  const present = new Set<SelectionLevel>(['partMeasure', 'measure', 'score']);
  const sequences = staffSequences(
    partMeasures(doc, cursor)[cursor.measureIndex]?.sequences,
    cursor.staffIndex ?? 1
  );
  if (sequences.length > 0) present.add('voiceMeasure');
  if (eventSlotAt(grid, cursor, projection)) present.add('event');
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

/**
 * The note keys a selection paints — each rung highlights exactly the notes
 * its operations can affect, rendered through the overlay that already exists.
 * The enclosure vocabulary consumes the same keys, so the operation footprint
 * and the visual claim cannot silently disagree.
 *
 * Everything here reads the CURSOR's part and staff, never `parts[0]`: the
 * part-measure rung walks staves with a bare arrow, so a fixed part would paint
 * one bar while the cursor addressed another. Global measure, section and score
 * selections deliberately cross part/staff boundaries; the narrower rungs do
 * not. Container descendants come from the canonical model walk.
 */
export function selectionNoteKeys(
  doc: MnxStructure,
  grid: PositionGrid,
  cursor: EditorCursor,
  level: SelectionLevel,
  projection: Projection
): string[] {
  if (level === 'note') {
    const slot = slotAt(grid, cursor, projection);
    return slot ? [slot.noteKey] : [];
  }

  const partIndex = cursor.partIndex ?? 0;
  const staffIndex = cursor.staffIndex ?? 1;
  const section = level === 'section' ? sectionRangeAt(doc, cursor.measureIndex) : null;
  const anchorEvent = eventSlotAt(grid, cursor, projection);

  const inScope = (address: {
    partIndex: number;
    staffIndex: number;
    measureIndex: number;
    voiceIndex: number;
    eventIndex: number;
    containerIndex?: number;
  }): boolean => {
    switch (level) {
      case 'event':
        return (
          !!anchorEvent &&
          address.partIndex === partIndex &&
          address.staffIndex === staffIndex &&
          address.measureIndex === cursor.measureIndex &&
          address.voiceIndex === anchorEvent.voiceIndex &&
          address.eventIndex === anchorEvent.eventIndex &&
          address.containerIndex === anchorEvent.containerIndex
        );
      case 'voiceMeasure':
        return (
          address.partIndex === partIndex &&
          address.staffIndex === staffIndex &&
          address.measureIndex === cursor.measureIndex &&
          address.voiceIndex === anchorVoiceIndex(cursor)
        );
      case 'partMeasure':
        return (
          address.partIndex === partIndex &&
          address.staffIndex === staffIndex &&
          address.measureIndex === cursor.measureIndex
        );
      case 'measure':
        return address.measureIndex === cursor.measureIndex;
      case 'section':
        return !!section && address.measureIndex >= section.start && address.measureIndex < section.end;
      case 'score':
        return true;
    }
  };

  const keys: string[] = [];
  forEachNoteAddress(doc, address => {
    if (inScope(address)) keys.push(address.key);
  });

  // Percussion lives in `kitNotes`, outside the ordinary note walk, but it is
  // still selectable ink and therefore belongs to every enclosing footprint.
  (doc.parts ?? []).forEach((part, p) => {
    (part.measures ?? []).forEach((measure, m) => {
      const voiceByStaff = new Map<number, number>();
      (measure.sequences ?? []).forEach(sequence => {
        const staff = sequence.staff ?? 1;
        const voice = (voiceByStaff.get(staff) ?? -1) + 1;
        voiceByStaff.set(staff, voice);
        sequence.content.forEach((item, eventIndex) => {
          if (!isTimedEvent(item)) return;
          const kitNotes = (item as { kitNotes?: unknown[] }).kitNotes ?? [];
          kitNotes.forEach((_, kitIndex) => {
            if (
              inScope({
                partIndex: p,
                staffIndex: staff,
                measureIndex: m,
                voiceIndex: voice,
                eventIndex
              })
            )
              keys.push(kitNoteKey(m, voice, eventIndex, kitIndex, p));
          });
        });
      });
    });
  });
  return keys;
}
