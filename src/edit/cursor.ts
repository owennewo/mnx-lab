// The position cursor — roadmap/complete/core-editor-input-layer.md.
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
import type { MnxEvent, MnxSequenceItem, MnxStructure, MnxNote } from '../model/mnx.ts';
import { isTimedEvent, isTuplet, isTremolo } from '../model/mnx.ts';
import { forEachNoteAddress, noteKeyAt } from '../model/noteWalk.ts';
import { kitNoteKey } from '../model/noteKeys.ts';
import { capoOf, defaultStringFor, isTabPart, midiOfPitch, tuningOf } from './tabStrings.ts';
import { clefAt, staffPositionOfPitch } from './staffSpace.ts';

/**
 * The active projection — which SPACE the cursor's vertical line addresses
 * (roadmap/inprogress/core-selection-ladder.md): 'tab' = the fingerboard (line is
 * a string number, 1 = top), 'notation' = the staff (line is a staff
 * position in half-staff-spaces from the middle line, positive up). Both
 * projections view ONE model; switching remaps the line, never the music.
 */
export type Projection = 'notation' | 'tab';

/** A metric onset within a measure, as a reduced whole-note fraction. */
export interface Onset {
  num: number;
  den: number;
}

/** One note sounding at a position, with the selection key the layouts use. */
export interface NoteSlot {
  /** `note.id`, or the synthetic positional key for id-less documents. */
  noteKey: string;
  /** The tab line: annotated string, else the heuristic default. */
  line: number;
  /** The notation line: staff position under the measure's clef. */
  staffPosition: number;
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
  /** Voice indices with a TIMED event starting here (rests included) — what
   *  the notation projection's voice-sticky walk stops at. */
  voices: number[];
}

export interface EditorCursor {
  measureIndex: number;
  onset: Onset;
  /** Vertical line: a string number in 'string' mode (1 = top), else an
   *  index into the position's note stack (0 = top). */
  line: number;
  /**
   * Which of the COINCIDENT notes at (onset × line) the cursor means — the
   * discriminator that (measure, onset, line) alone cannot carry.
   *
   * More than one note can share a moment and a line: two voices on one string
   * or staff position, two chord members the tab derivation puts on one string,
   * a grace note sharing its host's onset. Before this, `slotAt` took whichever
   * came first, so those notes were unreachable and Delete could act on a
   * neighbour — three separate campaign findings with one cause
   * (roadmap/inprogress/core-note-address.md, move 2).
   *
   * Absent means "the first one", so every cursor written before this stays
   * valid, and every MOVE drops it: a different line has a different set of
   * coincident notes, so carrying an ordinal across would be meaningless.
   */
  slotIndex?: number;
  /**
   * Which PART the cursor is editing (campaign item 13b). Absent means the
   * first, so every cursor written before parts were addressable stays valid —
   * and the grid is rebuilt per part, because one score-wide grid would merge
   * unrelated voices into shared columns.
   */
  partIndex?: number;
  /**
   * Which STAFF of that part (1-based). Absent means the first, so cursors
   * written before staves were addressable stay valid. A grand staff is two
   * spaces, not one taller one: the ladder addresses a staff at a time
   * (campaign item 13c).
   */
  staffIndex?: number;
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
  // A `space` is authored silence that OCCUPIES TIME, and its duration is a
  // RHYTHMIC FRACTION (`[1, 4]`) rather than the `{base, dots}` every other
  // item carries — which is why reading it with `durationSpan` produced zero
  // and the bar arithmetic went wrong wherever a space appeared. That single
  // mis-read blocked the container verb, the time-signature removal and the
  // rest-spelling attempt.
  const space = item as { type?: string; duration?: [number, number] };
  if (space.type === 'space')
    return Array.isArray(space.duration) ? reduce(space.duration[0], space.duration[1]) : { num: 0, den: 1 };
  return { num: 0, den: 1 };
}

/** A container's inner events, or null when the item is not a container. */
function containerEvents(item: MnxSequenceItem): MnxEvent[] | null {
  if (isTuplet(item) || isTremolo(item)) return item.content;
  const grace = item as { type?: string; content?: MnxEvent[] };
  return grace.type === 'grace' ? (grace.content ?? []) : null;
}

/** A tuplet's time scale (outer ÷ inner), or null for containers whose content
 *  does not advance the clock — grace notes are un-timed, and a tremolo's two
 *  events are alternations of one span rather than a sequence. */
function tupletScale(item: MnxSequenceItem): Onset | null {
  if (!isTuplet(item)) return null;
  const outer = durationSpan(item.outer.duration);
  const inner = durationSpan(item.inner.duration);
  return reduce(outer.num * item.outer.multiple * inner.den, outer.den * inner.num * item.inner.multiple);
}

function scaleOnset(span: Onset, scale: Onset): Onset {
  return reduce(span.num * scale.num, span.den * scale.den);
}

/** The key a note carries at these coordinates. Re-exported from the canonical
 *  walk (`model/noteWalk.ts`) so the editor and the layouts cannot drift. */
export const noteKeyOf = noteKeyAt;

/** Visit every staff-1 note of parts[0] with the selection key the layouts
 *  would give it. This is the addressing scheme EditOps resolve against —
 *  now a thin wrapper over the one enumeration that defines it. */
export function forEachKeyedNote(
  doc: MnxStructure,
  fn: (note: MnxNote, key: string) => void
): void {
  forEachNoteAddress(doc, address => fn(address.note, address.key));
}

/** Each measure's metric span from its (inherited) time signature — MNX time
 *  signatures persist until changed; 4/4 before the first one appears. */
export function measureSpans(doc: MnxStructure): Onset[] {
  let current: Onset = { num: 1, den: 1 };
  return (doc.global?.measures ?? []).map(measure => {
    if (measure.time) current = reduce(measure.time.count, measure.time.unit);
    return current;
  });
}

export function buildGrid(doc: MnxStructure, partIndex = 0, staffIndex = 1): PositionGrid {
  // Which part the cursor is in (campaign item 13b). One part at a time: a
  // score-wide grid would merge unrelated voices into shared columns, and the
  // ladder addresses one part's music at a time.
  const positions: Position[] = [];
  const part = doc.parts?.[partIndex];
  const measures = part?.measures ?? [];
  const measureCount = Math.max(measures.length, doc.global?.measures?.length ?? 0);
  const kit = (part as unknown as { kit?: Record<string, { staffPosition?: number }> } | undefined)?.kit;
  const tuning = tuningOf(part);
  const capo = capoOf(part);
  const spans = measureSpans(doc);
  const mode: PositionGrid['mode'] = isTabPart(part) ? 'string' : 'ordinal';

  interface RawSlot {
    slot: NoteSlot;
    midi: number;
    order: number;
  }

  for (let measureIndex = 0; measureIndex < measureCount; measureIndex++) {
    const clef = clefAt(doc, measureIndex, partIndex, staffIndex);
    const byOnset: { onset: Onset; raw: RawSlot[]; voices: Set<number> }[] = [];
    const at = (onset: Onset) => {
      let found = byOnset.find(p => onsetsEqual(p.onset, onset));
      if (!found) {
        found = { onset, raw: [], voices: new Set() };
        byOnset.push(found);
      }
      return found;
    };

    // Voice 0's fill point — where the next inserted event would start.
    let voiceZeroEnd: Onset = { num: 0, den: 1 };

    const voiceByStaff = new Map<number, number>();
    (measures[measureIndex]?.sequences ?? []).forEach(sequence => {
      const sequenceStaff = sequence.staff ?? 1;
      const voiceIndex = (voiceByStaff.get(sequenceStaff) ?? -1) + 1;
      voiceByStaff.set(sequenceStaff, voiceIndex);
      // One staff at a time: the grid is the space the cursor moves in.
      if (sequenceStaff !== staffIndex) return;
      let onset: Onset = { num: 0, den: 1 };
      sequence.content.forEach((item, eventIndex) => {
        const push = (event: MnxEvent, at_: Onset, containerIndex?: number) => {
          const position = at(at_);
          position.voices.add(voiceIndex);
          (event.notes ?? []).forEach((note, noteIndex) => {
            position.raw.push({
              slot: {
                noteKey: noteKeyAt(
                  note, measureIndex, voiceIndex, eventIndex, noteIndex, containerIndex, partIndex, sequenceStaff
                ),
                line: note._x?.mnxLab?.string ?? defaultStringFor(note.pitch, tuning, capo),
                staffPosition: staffPositionOfPitch(clef, note.pitch),
                voiceIndex,
                eventIndex,
                noteIndex
              },
              midi: midiOfPitch(note.pitch),
              order: position.raw.length
            });
          });
        };

        if (isTimedEvent(item)) {
          push(item, onset);
          // Percussion: kit notes are the ink of a kit part, and their staff
          // position comes from the component they name. Without this they are
          // drawn but unreachable — ink the cursor cannot address.
          const kitNotes = (item as { kitNotes?: { kitComponent?: string }[] }).kitNotes ?? [];
          if (kitNotes.length > 0) {
            const position = at(onset);
            position.voices.add(voiceIndex);
            kitNotes.forEach((kitNote, kitIndex) => {
              const component = kit?.[kitNote.kitComponent ?? ''];
              const staffPosition = component?.staffPosition ?? 0;
              position.raw.push({
                slot: {
                  noteKey: kitNoteKey(measureIndex, voiceIndex, eventIndex, kitIndex, partIndex),
                  line: staffPosition,
                  staffPosition,
                  voiceIndex,
                  eventIndex,
                  noteIndex: kitIndex
                },
                midi: 60 + staffPosition,
                order: position.raw.length
              });
            });
          }
        }
        else {
          // Container content (campaign item 11b). A tuplet's inner events have
          // real, scaled onsets — its written durations in the outer's time —
          // so they become their own columns. Grace and tremolo content shares
          // the host moment, which is addressable now that the cursor carries a
          // discriminator (core-note-address.md move 2).
          const inner = containerEvents(item);
          if (inner) {
            const scale = tupletScale(item);
            let innerOnset = onset;
            inner.forEach((event, containerIndex) => {
              if (!isTimedEvent(event)) return;
              push(event, innerOnset, containerIndex);
              if (scale) innerOnset = addOnsets(innerOnset, scaleOnset(durationSpan(event.duration), scale));
            });
          }
        }
        onset = addOnsets(onset, itemSpan(item));
      });
      if (voiceIndex === 0) voiceZeroEnd = onset;
    });

    // The entry ghost: the un-filled remainder of the measure (empty measure
    // → its start). A rest-only voice already made real positions, but the
    // ghost past the LAST event is what makes append-entry navigable. A ghost
    // is a potential event of VOICE 0, so it joins voice 0's walk — that is
    // what makes an empty bar addressable in the notation projection too.
    const span = spans[measureIndex] ?? { num: 1, den: 1 };
    if (onsetLess(voiceZeroEnd, span) && !byOnset.some(p => onsetsEqual(p.onset, voiceZeroEnd))) {
      byOnset.push({ onset: voiceZeroEnd, raw: [], voices: new Set([0]) });
    }
    if (byOnset.length === 0)
      byOnset.push({ onset: { num: 0, den: 1 }, raw: [], voices: new Set([0]) });

    byOnset.sort((a, b) => a.onset.num * b.onset.den - b.onset.num * a.onset.den);
    positions.push(
      ...byOnset.map(p => ({
        measureIndex,
        onset: p.onset,
        slots: p.raw
          .sort((a, b) => a.slot.line - b.slot.line || b.midi - a.midi || a.order - b.order)
          .map(r => r.slot),
        voices: [...p.voices].sort((a, b) => a - b)
      }))
    );
  }

  return { positions, mode, lineCount: tuning.length };
}

export function initialCursor(grid: PositionGrid): EditorCursor {
  const first = grid.positions[0];
  if (!first) return { measureIndex: 0, onset: { num: 0, den: 1 }, line: grid.mode === 'string' ? 1 : 0 };
  const line =
    grid.mode === 'string' ? first.slots[0]?.line ?? 1 : first.slots[0]?.staffPosition ?? 0;
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

/** The note slot the cursor selects: the note on its string (tab), or the
 *  note on its staff position (notation) — the line's meaning follows the
 *  active projection, both SPACES (selection-ladder navigation map). */
export function slotAt(
  grid: PositionGrid,
  cursor: EditorCursor,
  projection: Projection
): NoteSlot | undefined {
  const coincident = coincidentSlots(grid, cursor, projection);
  return coincident[cursor.slotIndex ?? 0];
}

/**
 * Every note sharing this moment and line, in the grid's visual order. Usually
 * one; when it is more, the cursor's `slotIndex` says which — and the fact that
 * there IS more than one is what the cycle key exists to reveal.
 */
export function coincidentSlots(
  grid: PositionGrid,
  cursor: EditorCursor,
  projection: Projection
): NoteSlot[] {
  const position = positionAt(grid, cursor);
  if (!position || position.slots.length === 0) return [];
  return projection === 'tab' && grid.mode === 'string'
    ? position.slots.filter(s => s.line === cursor.line)
    : position.slots.filter(s => s.staffPosition === cursor.line);
}

/** Step to the next note sharing this moment and line, wrapping. Returns the
 *  same cursor when there is nothing to disambiguate. */
export function cycleSlot(
  grid: PositionGrid,
  cursor: EditorCursor,
  projection: Projection
): EditorCursor {
  const count = coincidentSlots(grid, cursor, projection).length;
  if (count < 2) return cursor;
  return { ...cursor, slotIndex: ((cursor.slotIndex ?? 0) + 1) % count };
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
  return {
    measureIndex: target.measureIndex,
    onset: target.onset,
    line: cursor.line,
    ...carry(cursor)
  };
}

/** Where the cursor IS — part and staff — survives every move; what it means
 *  at that spot (the line's coincidence ordinal) does not. Dropping the part on
 *  a move sent edits back to `parts[0]` while the cursor showed part 2. */
function carry(cursor: EditorCursor): Pick<EditorCursor, 'partIndex' | 'staffIndex'> {
  return {
    ...(cursor.partIndex ? { partIndex: cursor.partIndex } : {}),
    ...(cursor.staffIndex && cursor.staffIndex !== 1 ? { staffIndex: cursor.staffIndex } : {})
  };
}

function toPosition(cursor: EditorCursor, position: Position): EditorCursor {
  return {
    measureIndex: position.measureIndex,
    onset: position.onset,
    line: cursor.line,
    ...carry(cursor)
  };
}

export function movePosition(grid: PositionGrid, cursor: EditorCursor, delta: 1 | -1): EditorCursor {
  const index = positionIndexOf(grid.positions, cursor);
  const next = grid.positions[index + delta];
  return next ? toPosition(cursor, next) : cursor;
}

/**
 * The voice-sticky INK walk (notation note-level ←→, and tab's Ctrl
 * event-skip): the prev/next position where the anchor voice has a timed
 * event — rests and its own entry ghost included, other voices' onsets
 * skipped. Landing 'nearest' re-aims the line at the anchor voice's
 * nearest-staff-position note (tie → upper); 'keep' holds the line (tab
 * stays on its string).
 */
export function movePositionInk(
  grid: PositionGrid,
  cursor: EditorCursor,
  delta: 1 | -1,
  projection: Projection,
  landing: 'nearest' | 'keep'
): EditorCursor {
  const index = positionIndexOf(grid.positions, cursor);
  if (index < 0) return cursor;
  const anchor = slotAt(grid, cursor, projection)?.voiceIndex ?? 0;
  for (let i = index + delta; i >= 0 && i < grid.positions.length; i += delta) {
    const position = grid.positions[i];
    if (!position.voices.includes(anchor)) continue;
    let line = cursor.line;
    if (landing === 'nearest') {
      const mine = position.slots.filter(s => s.voiceIndex === anchor);
      if (mine.length > 0) {
        let best = mine[0];
        for (const slot of mine) {
          const dist = Math.abs(slot.staffPosition - cursor.line);
          const bestDist = Math.abs(best.staffPosition - cursor.line);
          if (dist < bestDist || (dist === bestDist && slot.staffPosition > best.staffPosition))
            best = slot;
        }
        line = best.staffPosition;
      }
    }
    return { measureIndex: position.measureIndex, onset: position.onset, line, ...carry(cursor) };
  }
  return cursor;
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

/** How far the notation cursor may leave the staff, in staff positions
 *  (±16 = four ledger lines' worth each way). */
/** How far the cursor may travel above/below the middle line. Wide enough for
 *  ink an octave line puts out there: an 8va note in `spec/ottavas-8va` sits at
 *  staff position 17, and a hard 16 made it unreachable — the cursor could not
 *  go where the renderer had drawn. */
const STAFF_POSITION_RANGE = 24;

/** Walk the vertical axis of the active projection's SPACE: strings
 *  top→bottom on the fingerboard, staff positions (occupied or not) on the
 *  staff — visual down decreases the staff position (+up in MNX units). */
export function moveLine(
  grid: PositionGrid,
  cursor: EditorCursor,
  delta: 1 | -1,
  projection: Projection
): EditorCursor {
  if (projection === 'tab' && grid.mode === 'string') {
    const next = Math.min(Math.max(cursor.line + delta, 1), grid.lineCount);
    return { measureIndex: cursor.measureIndex, onset: cursor.onset, line: next, ...carry(cursor) };
  }
  const next = Math.min(Math.max(cursor.line - delta, -STAFF_POSITION_RANGE), STAFF_POSITION_RANGE);
  return { measureIndex: cursor.measureIndex, onset: cursor.onset, line: next, ...carry(cursor) };
}
