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
// Rungs not yet modelled: 'container' (tuplet/grace/tremolo) — the cursor
// treats containers as opaque (cursor.ts), so the ladder skips them the same
// way; the rung arrives with container-aware traversal. 'part' is DELIBERATELY
// not a rung: the ladder is the vertical axis, and the part is the horizontal
// CLOSURE of part-measure (Ctrl+A), per the roadmap doc.
import type { MnxSequence, MnxStructure } from '../model/mnx.ts';
import { isTimedEvent } from '../model/mnx.ts';
import {
  addOnsets,
  itemSpan,
  noteKeyOf,
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

/** The staff-1 filter, restated from the layouts (see cursor.ts header). */
function staffOneSequences(sequences: MnxSequence[] | undefined): MnxSequence[] {
  return (sequences ?? []).filter(seq => (seq.staff ?? 1) === 1);
}

/** The voice the selection anchors to: the voice of the note under the
 *  cursor, else voice 0 — the same primacy the session's duration ops use. */
export function anchorVoiceIndex(
  grid: PositionGrid,
  cursor: EditorCursor,
  projection: Projection
): number {
  return slotAt(grid, cursor, projection)?.voiceIndex ?? 0;
}

/** Index of the timed event starting exactly at `onset`, or -1. */
function eventIndexAt(sequence: MnxSequence | undefined, onset: Onset): number {
  if (!sequence) return -1;
  let at: Onset = { num: 0, den: 1 };
  for (let i = 0; i < sequence.content.length; i++) {
    const item = sequence.content[i];
    if (onsetsEqual(at, onset)) return isTimedEvent(item) ? i : -1;
    at = addOnsets(at, itemSpan(item));
  }
  return -1;
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
    doc.parts?.[0]?.measures?.length ?? 0
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
  const sequences = staffOneSequences(
    doc.parts?.[0]?.measures?.[cursor.measureIndex]?.sequences
  );
  if (sequences.length > 0) present.add('voiceMeasure');
  const voice = anchorVoiceIndex(grid, cursor, projection);
  if (eventIndexAt(sequences[voice], cursor.onset) >= 0) present.add('event');
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
 * (The enclosure vocabulary — cells, slices, beads, panels — is a later
 * phase; until then the footprint IS the visual.) partMeasure and measure
 * paint the same keys today because the cursor lives on parts[0]: the rungs
 * stay distinct — measure owns bar adornments, partMeasure the part's bar —
 * and diverge visually once the overlay reaches multi-part documents.
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

  const voice = anchorVoiceIndex(grid, cursor, projection);
  const section = level === 'section' ? sectionRangeAt(doc, cursor.measureIndex) : null;
  const anchorEvent =
    level === 'event'
      ? eventIndexAt(
          staffOneSequences(doc.parts?.[0]?.measures?.[cursor.measureIndex]?.sequences)[voice],
          cursor.onset
        )
      : -1;

  const keys: string[] = [];
  (doc.parts?.[0]?.measures ?? []).forEach((measure, measureIndex) => {
    if (level !== 'score') {
      if (section) {
        if (measureIndex < section.start || measureIndex >= section.end) return;
      } else if (measureIndex !== cursor.measureIndex) return;
    }
    staffOneSequences(measure.sequences).forEach((sequence, voiceIndex) => {
      if ((level === 'voiceMeasure' || level === 'event') && voiceIndex !== voice) return;
      sequence.content.forEach((item, eventIndex) => {
        if (!isTimedEvent(item)) return;
        if (level === 'event' && eventIndex !== anchorEvent) return;
        (item.notes ?? []).forEach((note, noteIndex) => {
          keys.push(noteKeyOf(note, measureIndex, voiceIndex, eventIndex, noteIndex));
        });
      });
    });
  });
  return keys;
}
