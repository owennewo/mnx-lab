// The position cursor — roadmap/inprogress/editor-input-layer.md.
//
// The cursor is a RHYTHMIC POSITION plus a VERTICAL LINE, not a note id: an
// empty measure has no note keys at all, so a note-list cursor would make a
// from-scratch document unnavigable. Traversal walks the beat grid; `noteKeys`
// remains the identity bridge for the notes *resolved at* a position (and the
// highlight overlay).
//
// The vertical axis has two modes (phase 2):
//  - 'string' (tab parts): the line is a STRING NUMBER (1 = top tab line,
//    printed-tab convention), whether or not a note sits there — standing on
//    an empty string at an empty beat is exactly where note entry happens.
//  - 'ordinal' (no tab extension): the line indexes the stack of notes at the
//    position, top first.
//
// The grid also carries GHOST positions: the un-filled remainder of a measure
// (from its time signature) after voice 0's last event, and the start of an
// empty measure. They hold no slots; they exist so the cursor can stand where
// the next note will be inserted.
//
// The traversal here mirrors the layout engines' (parts[0], staff-1
// sequences, events in content order) — the contract documented in
// src/model/noteKeys.ts. edit/ may not import engine/, so the staff filter is
// restated; noteKeys.ts is the shared spec both sides answer to.
import type { MnxSequenceItem, MnxSequence, MnxStructure, MnxNote } from '../model/mnx.ts';
import { isTimedEvent, isTuplet, isTremolo } from '../model/mnx.ts';
import { syntheticNoteKey } from '../model/noteKeys.ts';
import { defaultStringFor, midiOfPitch, tuningOf } from './tabStrings.ts';

/** A metric onset within a measure, as a reduced whole-note fraction. */
export interface Onset {
  num: number;
  den: number;
}

/** One note sounding at a position, with the selection key the layouts use. */
export interface NoteSlot {
  /** `note.id`, or the synthetic positional key for id-less documents. */
  noteKey: string;
  /** The visual line: annotated string, else the heuristic default. */
  line: number;
  voiceIndex: number;
  eventIndex: number;
  noteIndex: number;
}

/** One stop on the beat grid. Slots are in VISUAL order, top line first, so
 *  moving down the lines walks down the page — never document order, which
 *  typically runs low→high pitch and would invert the arrows. */
export interface Position {
  measureIndex: number;
  onset: Onset;
  slots: NoteSlot[];
}

export interface EditorCursor {
  measureIndex: number;
  onset: Onset;
  /** Vertical line: a string number in 'string' mode (1 = top), else an
   *  index into the position's note stack (0 = top). */
  line: number;
}

/** The whole navigable surface of a document, rebuilt after every edit. */
export interface PositionGrid {
  positions: Position[];
  mode: 'string' | 'ordinal';
  /** Number of vertical lines in 'string' mode (the tuning's string count). */
  lineCount: number;
}

function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function reduce(num: number, den: number): Onset {
  if (num === 0) return { num: 0, den: 1 };
  if (den < 0) {
    num = -num;
    den = -den;
  }
  const g = gcd(Math.abs(num), Math.abs(den));
  return { num: num / g, den: den / g };
}

export function addOnsets(a: Onset, b: Onset): Onset {
  return reduce(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function onsetsEqual(a: Onset, b: Onset): boolean {
  return a.num * b.den === b.num * a.den;
}

export function onsetLess(a: Onset, b: Onset): boolean {
  return a.num * b.den < b.num * a.den;
}

/** MNX note-value bases as whole-note fractions. */
const BASE_WHOLE_FRACTIONS: Record<string, Onset> = {
  duplexMaxima: { num: 16, den: 1 },
  maxima: { num: 8, den: 1 },
  longa: { num: 4, den: 1 },
  breve: { num: 2, den: 1 },
  whole: { num: 1, den: 1 },
  half: { num: 1, den: 2 },
  quarter: { num: 1, den: 4 },
  eighth: { num: 1, den: 8 },
  '16th': { num: 1, den: 16 },
  '32nd': { num: 1, den: 32 },
  '64th': { num: 1, den: 64 },
  '128th': { num: 1, den: 128 },
  '256th': { num: 1, den: 256 },
  '512th': { num: 1, den: 512 },
  '1024th': { num: 1, den: 1024 },
  '2048th': { num: 1, den: 2048 },
  '4096th': { num: 1, den: 4096 }
};

export function durationSpan(duration: { base: string; dots?: number } | undefined): Onset {
  const base = duration ? BASE_WHOLE_FRACTIONS[duration.base] : undefined;
  if (!base) return { num: 0, den: 1 };
  const dots = duration?.dots ?? 0;
  // n dots multiply by (2^(n+1) − 1) / 2^n.
  const scale = Math.pow(2, dots);
  return reduce(base.num * (2 * scale - 1), base.den * scale);
}

/** Metric width of one sequence item. Containers are opaque to the cursor for
 *  now (their inner notes get no slots) but must still advance the clock so
 *  the positions after them stay honest. Grace content is un-timed → 0. */
export function itemSpan(item: MnxSequenceItem): Onset {
  if (isTimedEvent(item)) return durationSpan(item.duration);
  if (isTuplet(item)) {
    const outer = durationSpan(item.outer.duration);
    return reduce(outer.num * item.outer.multiple, outer.den);
  }
  if (isTremolo(item)) {
    if (item.outer) {
      const outer = durationSpan(item.outer.duration);
      return reduce(outer.num * (item.outer.multiple ?? 1), outer.den);
    }
    // No outer: the two written events each carry the total duration.
    const first = item.content[0];
    return first ? durationSpan(first.duration) : { num: 0, den: 1 };
  }
  return { num: 0, den: 1 };
}

/** The staff-1 filter, restated from the layouts (see file header). */
function staffOneSequences(sequences: MnxSequence[] | undefined): MnxSequence[] {
  return (sequences ?? []).filter(seq => (seq.staff ?? 1) === 1);
}

export function noteKeyOf(
  note: MnxNote,
  measureIndex: number,
  voiceIndex: number,
  eventIndex: number,
  noteIndex: number
): string {
  return note.id ?? syntheticNoteKey(measureIndex, voiceIndex, eventIndex, noteIndex);
}

/** Visit every staff-1 note of parts[0] with the selection key the layouts
 *  would give it. This is the addressing scheme EditOps resolve against. */
export function forEachKeyedNote(
  doc: MnxStructure,
  fn: (note: MnxNote, key: string) => void
): void {
  (doc.parts[0]?.measures ?? []).forEach((measure, measureIndex) => {
    staffOneSequences(measure.sequences).forEach((sequence, voiceIndex) => {
      sequence.content.forEach((item, eventIndex) => {
        if (!isTimedEvent(item)) return;
        (item.notes ?? []).forEach((note, noteIndex) => {
          fn(note, noteKeyOf(note, measureIndex, voiceIndex, eventIndex, noteIndex));
        });
      });
    });
  });
}

/** Each measure's metric span from its (inherited) time signature — MNX time
 *  signatures persist until changed; 4/4 before the first one appears. */
export function measureSpans(doc: MnxStructure): Onset[] {
  let current: Onset = { num: 1, den: 1 };
  return doc.global.measures.map(measure => {
    if (measure.time) current = reduce(measure.time.count, measure.time.unit);
    return current;
  });
}

export function buildGrid(doc: MnxStructure): PositionGrid {
  const positions: Position[] = [];
  const part = doc.parts[0];
  const measures = part?.measures ?? [];
  const measureCount = Math.max(measures.length, doc.global.measures.length);
  const tuning = tuningOf(part);
  const spans = measureSpans(doc);
  const mode: PositionGrid['mode'] = part?._x?.mnxLab?.tab ? 'string' : 'ordinal';

  interface RawSlot {
    slot: NoteSlot;
    midi: number;
    order: number;
  }

  for (let measureIndex = 0; measureIndex < measureCount; measureIndex++) {
    const byOnset: { onset: Onset; raw: RawSlot[] }[] = [];
    const at = (onset: Onset) => {
      let found = byOnset.find(p => onsetsEqual(p.onset, onset));
      if (!found) {
        found = { onset, raw: [] };
        byOnset.push(found);
      }
      return found;
    };

    // Voice 0's fill point — where the next inserted event would start.
    let voiceZeroEnd: Onset = { num: 0, den: 1 };

    staffOneSequences(measures[measureIndex]?.sequences).forEach((sequence, voiceIndex) => {
      let onset: Onset = { num: 0, den: 1 };
      sequence.content.forEach((item, eventIndex) => {
        if (isTimedEvent(item)) {
          const position = at(onset);
          (item.notes ?? []).forEach((note, noteIndex) => {
            position.raw.push({
              slot: {
                noteKey: noteKeyOf(note, measureIndex, voiceIndex, eventIndex, noteIndex),
                line: note._x?.mnxLab?.tab?.position?.string ?? defaultStringFor(note.pitch, tuning),
                voiceIndex,
                eventIndex,
                noteIndex
              },
              midi: midiOfPitch(note.pitch),
              order: position.raw.length
            });
          });
        }
        onset = addOnsets(onset, itemSpan(item));
      });
      if (voiceIndex === 0) voiceZeroEnd = onset;
    });

    // The entry ghost: the un-filled remainder of the measure (empty measure
    // → its start). A rest-only voice already made real positions, but the
    // ghost past the LAST event is what makes append-entry navigable.
    const span = spans[measureIndex] ?? { num: 1, den: 1 };
    if (onsetLess(voiceZeroEnd, span) && !byOnset.some(p => onsetsEqual(p.onset, voiceZeroEnd))) {
      byOnset.push({ onset: voiceZeroEnd, raw: [] });
    }
    if (byOnset.length === 0) byOnset.push({ onset: { num: 0, den: 1 }, raw: [] });

    byOnset.sort((a, b) => a.onset.num * b.onset.den - b.onset.num * a.onset.den);
    positions.push(
      ...byOnset.map(p => ({
        measureIndex,
        onset: p.onset,
        slots: p.raw
          .sort((a, b) => a.slot.line - b.slot.line || b.midi - a.midi || a.order - b.order)
          .map(r => r.slot)
      }))
    );
  }

  return { positions, mode, lineCount: tuning.length };
}

export function initialCursor(grid: PositionGrid): EditorCursor {
  const first = grid.positions[0];
  if (!first) return { measureIndex: 0, onset: { num: 0, den: 1 }, line: grid.mode === 'string' ? 1 : 0 };
  const line =
    grid.mode === 'string' ? first.slots[0]?.line ?? 1 : 0;
  return { measureIndex: first.measureIndex, onset: first.onset, line };
}

function positionIndexOf(positions: Position[], cursor: EditorCursor): number {
  return positions.findIndex(
    p => p.measureIndex === cursor.measureIndex && onsetsEqual(p.onset, cursor.onset)
  );
}

/** The position under the cursor (after clamping — see clampCursor). */
export function positionAt(grid: PositionGrid, cursor: EditorCursor): Position | undefined {
  return grid.positions[positionIndexOf(grid.positions, cursor)];
}

/** The note slot the cursor selects: the note on its string ('string' mode),
 *  or the line-th note of the stack ('ordinal' mode). */
export function slotAt(grid: PositionGrid, cursor: EditorCursor): NoteSlot | undefined {
  const position = positionAt(grid, cursor);
  if (!position || position.slots.length === 0) return undefined;
  if (grid.mode === 'string') return position.slots.find(s => s.line === cursor.line);
  return position.slots[Math.min(Math.max(cursor.line, 0), position.slots.length - 1)];
}

/**
 * Re-anchor a cursor after the document (and therefore the grid) changed:
 * keep the measure/onset when it still exists, else the nearest position in
 * the same measure, else the last position. The line is preserved.
 */
export function clampCursor(grid: PositionGrid, cursor: EditorCursor): EditorCursor {
  if (grid.positions.length === 0) return initialCursor(grid);
  if (positionIndexOf(grid.positions, cursor) >= 0) return cursor;
  const inMeasure = grid.positions.filter(p => p.measureIndex === cursor.measureIndex);
  const target = inMeasure[inMeasure.length - 1] ?? grid.positions[grid.positions.length - 1];
  return { measureIndex: target.measureIndex, onset: target.onset, line: cursor.line };
}

function toPosition(cursor: EditorCursor, position: Position): EditorCursor {
  return { measureIndex: position.measureIndex, onset: position.onset, line: cursor.line };
}

export function movePosition(grid: PositionGrid, cursor: EditorCursor, delta: 1 | -1): EditorCursor {
  const index = positionIndexOf(grid.positions, cursor);
  const next = grid.positions[index + delta];
  return next ? toPosition(cursor, next) : cursor;
}

/** Jump to the first position of the neighbouring measure. */
export function moveMeasure(grid: PositionGrid, cursor: EditorCursor, delta: 1 | -1): EditorCursor {
  const target = cursor.measureIndex + delta;
  const first = grid.positions.find(p => p.measureIndex === target);
  return first ? toPosition(cursor, first) : cursor;
}

/** Jump to the first position of an absolute measure, clamped to the score. */
export function moveToMeasure(
  grid: PositionGrid,
  cursor: EditorCursor,
  measureIndex: number
): EditorCursor {
  const last = grid.positions[grid.positions.length - 1];
  if (!last) return cursor;
  const target = Math.min(Math.max(measureIndex, 0), last.measureIndex);
  const first = grid.positions.find(p => p.measureIndex === target);
  return first ? toPosition(cursor, first) : cursor;
}

/** Walk the vertical axis: strings top→bottom in 'string' mode (clamped to
 *  the fingerboard), the note stack in 'ordinal' mode. */
export function moveLine(grid: PositionGrid, cursor: EditorCursor, delta: 1 | -1): EditorCursor {
  if (grid.mode === 'string') {
    const next = Math.min(Math.max(cursor.line + delta, 1), grid.lineCount);
    return { ...cursor, line: next };
  }
  const position = positionAt(grid, cursor);
  if (!position || position.slots.length === 0) return cursor;
  const current = Math.min(Math.max(cursor.line, 0), position.slots.length - 1);
  const next = Math.min(Math.max(current + delta, 0), position.slots.length - 1);
  return { ...cursor, line: next };
}
