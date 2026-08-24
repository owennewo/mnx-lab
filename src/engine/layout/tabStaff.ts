import { MnxEvent, MnxGrace, MnxSequence, MnxTuplet, isGrace, isTimedEvent, isTuplet } from '../../model/mnx.ts';
import {
  GUITAR_TUNING,
  midiOfMnxPitch,
  resolveEventPositions,
  TabPositionContext
} from '../tab/guitarPositions.ts';
import { Primitive, SpatialIndex } from '../primitives.ts';
import { noteKeyAt } from '../../model/noteWalk.ts';
import { CORE_SP, EventSlot, GRACE_NOTE_ADVANCE_SP, tupletColumns } from './spacing.ts';
import {
  harmonicFretText,
  nextOrdinal,
  recordSite,
  tabTechniqueLaneY,
  techniqueOf,
  type TechniqueCollector
} from './technique.ts';

/**
 * The tab STAFF: everything needed to draw six string lines, the TAB clef,
 * the tab-style time signature and fret digits — shared verbatim between the
 * standalone tab layout (src/engine/layout/tab.ts) and the notation layout's
 * native tab staff kind in the combined `both` system
 * (roadmap/complete/core-both-view-single-system.md phase 2). One source, so the
 * standalone view and the combined system cannot drift; the tab goldens pin
 * this module through tab.ts byte-for-byte.
 */

// ---------- Tab staff geometry (staff spaces) ----------

export const TAB_STAFF_LINES = 6;

/**
 * The notation staff's height (5 lines ⇒ 4 sp) — the reference the tab staff is
 * sized against. Deliberately duplicated from notation.ts's private
 * STAFF_HEIGHT_SP rather than imported: notation.ts imports THIS module, so the
 * dependency only runs one way.
 */
const NOTATION_STAFF_HEIGHT_SP = 4;

/**
 * Notation height ÷ tab height. Engravers commonly open the tab staff up a
 * little for legibility — fret digits are text sitting ON the string lines, not
 * noteheads sitting between staff lines, so they need more room than a plain
 * "one string line per staff space" (ratio 0.8) gives them. Published practice
 * sits between 0.70 and 0.80; 0.70 is the roomy end of that range.
 */
export const TAB_TO_NOTATION_HEIGHT_RATIO = 0.7;

/** Distance between adjacent string lines — the single knob for tab openness. */
export const TAB_STRING_SPACING_SP =
  NOTATION_STAFF_HEIGHT_SP / TAB_TO_NOTATION_HEIGHT_RATIO / (TAB_STAFF_LINES - 1);

/** Top string to bottom string. */
export const TAB_STAFF_HEIGHT_SP = (TAB_STAFF_LINES - 1) * TAB_STRING_SPACING_SP;

export const TAB_STAFF_LINE_THICKNESS_SP = 0.1;

const FRET_FONT_SIZE_SP = 1.25;

/**
 * Fret digits are the tab staff's ONLY musical content — the reader's eye goes
 * to them and nothing else — so they carry the boldest weight in the engine.
 * 700 is a real bundled face (`@fontsource/archivo/latin-700` in
 * src/entries/main.ts), not a synthesized one; the rest of the engine's `bold`
 * text resolves to the same face.
 */
const FRET_FONT_WEIGHT = 700;

/**
 * The digit's mask over the string line. Tracks the font size so a larger digit
 * cannot spill past the hole it punches, but is CAPPED clear of the next
 * string: if two masks on adjacent strings met, a chord would erase the staff
 * lines between its digits and the tab would read as broken.
 */
const FRET_BG_HEIGHT_SP = Math.min(
  FRET_FONT_SIZE_SP * 0.85,
  TAB_STRING_SPACING_SP - 0.12
);

const ACTIVE_COLOR = 'oklch(0.65 0.22 274)';
const SELECTED_COLOR = 'oklch(0.7 0.15 190)';
// The fret digit's backing rect masks the string line under it, so it must be
// the SCORE PAPER colour — which never inverts with the theme — not the app
// chrome (`--bg-app`, which is dark in dark mode and undefined in the standalone
// preview/embed, where it falls back to black and hides the digit). Carries the
// paper token's own fallback so it resolves even where `--paper` isn't defined.
const FRET_BG_FILL = 'var(--paper, oklch(0.985 0.006 85))';

// ---------- Grace notes and tuplets on the fingerboard ----------

/**
 * Grace digits, relative to full size. The notation staff uses 0.6 for the
 * same job (`GRACE_SCALE`), and matching it is what makes the two staves of a
 * `both` system read as one gesture rather than two decisions.
 */
const GRACE_FRET_SCALE = 0.6;

/**
 * How far above the top string line a tuplet bracket sits.
 *
 * Clear of the technique lane (`tabTechniqueLaneY`, 0.4sp up), because a
 * hammer-on slur and a triplet bracket are both drawn above the staff and both
 * belong to the same notes — overlapping them would make each unreadable. The
 * row frame does not need widening for it: `tightenRows` measures the ink that
 * is actually there.
 */
const TAB_TUPLET_RISE_SP = 2.1;
const TAB_TUPLET_BRACKET_THICKNESS_SP = 0.1;
/** Bracket end hooks, pointing down at the staff. */
const TAB_TUPLET_HOOK_SP = 0.5;
const TAB_TUPLET_NUMBER_SIZE_SP = 1.1;
/** Gap either side of the number, where the bracket breaks for it. */
const TAB_TUPLET_NUMBER_GAP_SP = 0.85;

// ---------- System header: capo + tuning instructions ----------

const CAPO_FONT_SIZE_SP = 1.1;
const CAPO_RISE_SP = 1.5; // above the top string line
const CAPO_INSET_SP = 0.4; // clear of the system-start barline
const TUNING_LETTER_SIZE_SP = 0.85;
const TUNING_LETTER_INSET_SP = 0.35; // gap between letter and the system start

/** "D" / "C#" / "Eb" — the letter a tuning peg is set to (octave omitted,
 *  like every printed tuning legend). */
function tuningLetter(pitch: { step: string; alter?: number }): string {
  const alter = pitch.alter ?? 0;
  return pitch.step + (alter > 0 ? '#'.repeat(alter) : 'b'.repeat(-alter));
}

/**
 * The player-facing setup instructions, drawn once above/beside the FIRST bar
 * (standard publishing practice — never repeated per system), from the
 * EFFECTIVE context — so a viewer-supplied instrument override renders
 * honestly, exactly like a document declaration:
 *
 *   - "Capo N" text above the top string line, when a capo is in effect.
 *   - Guitar-Pro-style open-string letters at the line starts, when the
 *     effective tuning differs from standard guitar — the letters appear
 *     exactly when the player must retune.
 *
 * Letters show the PHYSICAL tuning (no capo shift): they are peg-setting
 * instructions, and the capo line above already carries the rest.
 */
export function emitTabSystemHeader(
  ctx: TabPositionContext,
  x: number,
  staffTop: number,
  /** The plan's ink ratio — the insets either side of the system start are
   *  text clearances, so they are ink like every other glyph-relative gap. */
  ink: number,
  primitives: Primitive[]
): void {
  const capo = ctx.capo;
  if (capo > 0) {
    primitives.push({
      kind: 'text',
      text: `Capo ${capo}`,
      x: x + CAPO_INSET_SP * ink,
      y: staffTop - CAPO_RISE_SP,
      font: 'body',
      size: CAPO_FONT_SIZE_SP,
      anchor: 'start',
      baseline: 'central',
      weight: 600,
      className: 'tab-capo'
    });
  }

  const strings = ctx.strings;
  const standard =
    strings.length === GUITAR_TUNING.length &&
    strings.every(s => GUITAR_TUNING[s.string - 1] === midiOfMnxPitch(s.pitch));
  if (standard) return;

  for (const entry of strings) {
    primitives.push({
      kind: 'text',
      text: tuningLetter(entry.pitch),
      x: x - TUNING_LETTER_INSET_SP * ink,
      y: staffTop + (entry.string - 1) * TAB_STRING_SPACING_SP,
      font: 'body',
      size: TUNING_LETTER_SIZE_SP,
      anchor: 'end',
      baseline: 'central',
      className: 'tab-tuning-letter'
    });
  }
}

// ---------- Prefix emission ----------

/** The six string lines of one measure's tab staff. */
export function emitTabStaffLines(
  x: number,
  width: number,
  staffTop: number,
  primitives: Primitive[]
): void {
  // Staff lines (drawn as primitives — per SMuFL guidance, don't use staff6Lines glyph)
  for (let s = 0; s < TAB_STAFF_LINES; s++) {
    const lineY = staffTop + s * TAB_STRING_SPACING_SP;
    primitives.push({
      kind: 'line',
      x1: x, y1: lineY, x2: x + width, y2: lineY,
      thickness: TAB_STAFF_LINE_THICKNESS_SP,
      className: 'staff-line'
    });
  }
}

/** The TAB clef, centred on the staff. */
export function emitTabClef(clefX: number, staffTop: number, primitives: Primitive[]): void {
  primitives.push({
    kind: 'glyph',
    glyph: '6stringTabClef',
    x: clefX,
    y: staffTop + TAB_STAFF_HEIGHT_SP / 2,
    className: 'tab-clef'
  });
}

/** Time signature, tab style: digits centred in the staff's upper/lower halves. */
export function emitTabTimeSig(
  timeSig: { count: number; unit: number },
  centreX: number,
  staffTop: number,
  primitives: Primitive[]
): void {
  const numCenterY = staffTop + TAB_STAFF_HEIGHT_SP / 4;
  const denCenterY = staffTop + (3 * TAB_STAFF_HEIGHT_SP) / 4;

  // SMuFL time-sig digits have their alphabetic baseline at the visual
  // centre of the digit, so y = centre directly.
  for (const digit of String(timeSig.count)) {
    primitives.push({
      kind: 'glyph',
      glyph: 'timeSig' + digit,
      x: centreX,
      y: numCenterY,
      anchor: 'middle',
      className: 'time-sig-num'
    });
  }
  for (const digit of String(timeSig.unit)) {
    primitives.push({
      kind: 'glyph',
      glyph: 'timeSig' + digit,
      x: centreX,
      y: denCenterY,
      anchor: 'middle',
      className: 'time-sig-den'
    });
  }
}

// ---------- Event emission ----------

export interface EmitTabVoicesArgs {
  /** The staff's voices for this measure (already staff-filtered/resolved). */
  voices: readonly Pick<MnxSequence, 'content'>[];
  /** Per voice, per event: the plan's column slot (same table both layouts read). */
  slots: readonly (readonly EventSlot[])[];
  staffTop: number;
  /**
   * The plan's ink ratio (core-ink-priced-columns.md). Every offset FROM the
   * column centre is ink and scales by it — here, the half-width that places
   * the knock-out rect's left edge. The rect's *width* is emitted on the
   * vertical scale already (`emitRect` uses `ky` for a non-`spanW` rect), so
   * leaving the left edge unscaled slid the rect right of the digit it masks
   * and the fret number read as left-aligned against the string line.
   */
  ink: number;
  measureIndex: number;
  activeNoteIds: readonly string[];
  selectedNoteIds: readonly string[];
  /**
   * Synthesize positional keys for id-less notes. Only a staff showing exactly
   * the staff-1-of-first-part traversal that jsonView mirrors may do this;
   * elsewhere id-less notes simply aren't clickable.
   */
  synthesizeKeys: boolean;
  primitives: Primitive[];
  index: SpatialIndex;
  /** Forgiving render: a throwing event reports here, never kills the bar. */
  onIssue: (message: string) => void;
  /**
   * The effective string set (document declaration or viewer override, capo
   * applied) — the derivation context for every fret drawn. Callers must
   * resolve it first; a staff with no context draws no frets at all.
   */
  positionContext: TabPositionContext;
  /** This measure's system row, and where its end barline sits: a technique
   *  mark lasts the note's duration and may travel to a note on another row,
   *  so both are geometry the post-pass cannot recover from a primitive. */
  row: number;
  measureEndX: number;
  /** Where the technique post-pass's sites are gathered
   *  (roadmap/complete/core-guitar-technique.md). One collector per tab staff. */
  technique: TechniqueCollector;
  /**
   * Whether this staff draws its own tuplet brackets.
   *
   * True for the STANDALONE tab view, where the bracket is the only thing
   * saying a group is a triplet. False in the `both` system: the notation staff
   * directly above draws the same bracket over the same columns, and printing
   * it twice is how one gesture starts reading as two.
   */
  showTupletBrackets: boolean;
  /**
   * The plan's accidental context — `mnx.support.useAccidentalDisplay` and this
   * measure's key signature.
   *
   * Purely notation ink, and a tab staff draws none of it, but the PLAN priced
   * each of a tuplet's inner columns with an accidental slot where the notation
   * staff will need one. Walking those columns with a different context would
   * come out a slot narrower and slide every digit after it out of column with
   * the notation staff above.
   */
  accidentalContext: { useAccidentalDisplay: boolean; keyFifths: number };
}

/**
 * Fret digits (with their string-line knock-out rects) for one measure of one
 * tab staff, plus index entries for click/highlight.
 */
/**
 * Where a container's inner events sit, in absolute x.
 *
 * The plan reserved ONE column for the whole container and `slot.x` is the
 * centre of its FIRST inner core; everything after that is a walk over the
 * same rigid widths the plan priced. `spacing.ts` owns those widths
 * (`tupletColumns` for a tuplet, `GRACE_NOTE_ADVANCE_SP` per grace), so this
 * reads them rather than restating them — the notation layout walks the very
 * same numbers, and a walk that disagreed by one term would slide the tab out
 * of column from that note onward.
 *
 * `endX` is the next inner column, or the container's own end: a bend curve
 * drawn across a tuplet member must stop at the next member, not at the bar.
 */
function innerColumns(
  container: MnxGrace | MnxTuplet,
  firstX: number,
  ink: number,
  accidentalContext: { useAccidentalDisplay: boolean; keyFifths: number }
): { event: MnxEvent; x: number; endX: number }[] {
  const events = container.content;
  const xs: number[] = [];

  if (isTuplet(container)) {
    // The inner columns are rigid ink, priced by the plan at this ratio — so
    // the accidental leading and the core half-width are both scaled, term for
    // term as `emitTupletGroup` scales them.
    const cols = tupletColumns(
      container,
      accidentalContext.useAccidentalDisplay,
      accidentalContext.keyFifths
    );
    let colStart = firstX - (CORE_SP / 2) * ink;
    for (let j = 0; j < events.length; j++) {
      const col = cols[j] ?? { leading: 0, advance: CORE_SP };
      xs.push(colStart + col.leading * ink + (CORE_SP / 2) * ink);
      colStart += col.advance * ink;
    }
  } else {
    for (let j = 0; j < events.length; j++) {
      xs.push(firstX + j * GRACE_NOTE_ADVANCE_SP * ink);
    }
  }

  return events.map((event, j) => ({
    event,
    x: xs[j],
    // The last inner event ends where its own column does; there is no next
    // slot to ask, and the bar's end would be a lie for a grace note.
    endX: xs[j + 1] ?? xs[j] + CORE_SP * ink
  }));
}

/**
 * A tuplet's bracket and number over a tab staff.
 *
 * Always bracketed, unlike the notation staff — there, a fully beamed group
 * puts its number on the beam and needs no bracket, but a tab staff draws no
 * beams at all, so the bracket is the only thing that says where the group
 * begins and ends. `bracket: 'no'` is still honoured: it is an explicit
 * instruction, not an inference.
 */
function emitTabTupletBracket(
  tuplet: MnxTuplet,
  firstX: number,
  lastX: number,
  staffTop: number,
  primitives: Primitive[]
): void {
  const y = staffTop - TAB_TUPLET_RISE_SP;
  const number = tuplet.showNumber === 'noNumber' ? null : String(tuplet.inner.multiple);

  if (number !== null) {
    primitives.push({
      kind: 'text',
      text: number,
      x: (firstX + lastX) / 2,
      y,
      font: 'body',
      size: TAB_TUPLET_NUMBER_SIZE_SP,
      anchor: 'middle',
      baseline: 'central',
      className: 'tuplet-number'
    });
  }

  if (tuplet.bracket === 'no') return;

  const centre = (firstX + lastX) / 2;
  const gap = number === null ? 0 : TAB_TUPLET_NUMBER_GAP_SP / 2;
  // Two arms with the number in the break between them, and a hook at each
  // outer end pointing down at the notes the group covers.
  for (const [x1, x2] of [
    [firstX, centre - gap],
    [centre + gap, lastX]
  ]) {
    if (x2 <= x1) continue;
    primitives.push({
      kind: 'line',
      x1, y1: y, x2, y2: y,
      thickness: TAB_TUPLET_BRACKET_THICKNESS_SP,
      className: 'tuplet-bracket'
    });
  }
  for (const x of [firstX, lastX]) {
    primitives.push({
      kind: 'line',
      x1: x, y1: y, x2: x, y2: y + TAB_TUPLET_HOOK_SP,
      thickness: TAB_TUPLET_BRACKET_THICKNESS_SP,
      className: 'tuplet-bracket'
    });
  }
}

export function emitTabVoices(args: EmitTabVoicesArgs): void {
  const {
    voices, slots, staffTop, ink, measureIndex, positionContext,
    activeNoteIds, selectedNoteIds, synthesizeKeys, primitives, index, onIssue,
    row, measureEndX, technique: techniqueSites, showTupletBrackets, accidentalContext
  } = args;
  const laneY = tabTechniqueLaneY(staffTop);

  // A note written in two voices at one fingerboard position is ONE note.
  // Both copies land on the same digit, so drawing the second is redundant
  // (and doubles the glyph's anti-aliasing). Keyed by column + string + fret,
  // so a genuine conflict — different frets, one string — still draws both
  // and stays visible next to its red badge.
  const drawnFrets = new Set<string>();

  /**
   * One event's fret digits, wherever it sits: directly in the sequence, or
   * inside a grace or tuplet container.
   *
   * `containerIndex` and `scale` are the whole of the difference. The key a
   * digit carries has to be the one `model/noteWalk.ts` produces for that note
   * — nested for container content — or the editor cannot address what the
   * renderer drew, and `harness/conformance/note-keys.test.ts` says so over the
   * whole corpus.
   */
  const drawEvent = (input: {
    event: MnxEvent;
    eventIndex: number;
    containerIndex?: number;
    eventX: number;
    eventEndX: number;
    /** Digit size relative to full — < 1 for grace notes. */
    scale: number;
    voiceKey: string;
    ordinal: number;
    voiceIndex: number;
  }): void => {
    const {
      event, eventIndex, containerIndex, eventX, eventEndX, scale, voiceKey, ordinal, voiceIndex
    } = input;
    if (event.rest) {
      // Tab convention: rests in tab-only view consume time but aren't
      // drawn. (When tab pairs with a notation staff, rests live there.)
      return;
    }
    if (!event.notes || event.notes.length === 0) return;

    const fontSize = FRET_FONT_SIZE_SP * scale;
    const bgHeight = FRET_BG_HEIGHT_SP * scale;
    const positions = resolveEventPositions(event.notes, positionContext);
    // Per-note selection keys: real ids, or synthesized positional keys
    // for id-less documents (see src/model/noteKeys.ts).
    const noteIds = event.notes.map((n, idx) =>
      synthesizeKeys
        ? noteKeyAt(n, measureIndex, voiceIndex, eventIndex, idx, containerIndex)
        : n.id
    );
    const primaryNoteId = noteIds[0];

    for (let k = 0; k < positions.length; k++) {
      const pos = positions[k];
      // Unplayable (no position derivable): draw nothing — the red badge
      // comes from validate.ts, never a silently clamped digit.
      if (pos === null) continue;
      const noteId = noteIds[k] ?? primaryNoteId;

      // Per NOTE, not per event: the editor's cursor is one note of a
      // chord, and highlighting the whole event would erase it.
      const isActive = noteId !== undefined && activeNoteIds.includes(noteId);
      const isSelected = noteId !== undefined && selectedNoteIds.includes(noteId);
      const fretFill = isActive ? ACTIVE_COLOR : isSelected ? SELECTED_COLOR : undefined;

      const fretSlot = `${Math.round(eventX * 1e4)}:${pos.str}:${pos.fret}`;
      if (drawnFrets.has(fretSlot)) continue;
      drawnFrets.add(fretSlot);

      const stringY = staffTop + (pos.str - 1) * TAB_STRING_SPACING_SP;
      // A harmonic is the one technique that changes the DIGIT rather than
      // adding a mark beside it: `<12>` is how a tab reader is told the
      // fret is a node to touch, not a note to stop. Drawn here, with the
      // digit, so one mask still covers exactly one text.
      const note = event.notes[k];
      const technique = note ? techniqueOf(note) : undefined;
      const fretStr = technique?.harmonic
        ? harmonicFretText(String(pos.fret))
        : String(pos.fret);
      const charWidthSp = fontSize * 0.6 * Math.max(1, fretStr.length);

      // The geometry the technique post-pass draws against — recorded even
      // when this note carries none, because another note's hammer-on may
      // name it as its destination. A grace takes no ordinal, so it records
      // no site: it is never a technique's origin or destination beat.
      if (ordinal >= 0) {
        recordSite(techniqueSites, {
          x: eventX,
          endX: eventEndX,
          y: stringY,
          laneY,
          row,
          halfWidthSp: charWidthSp / 2,
          voiceKey,
          ordinal,
          fret: pos.fret,
          ...(note?.id !== undefined ? { noteId: note.id } : {}),
          ...(technique ? { technique } : {})
        });
      }

      // Background rect obscures the staff line under the digit. Its width
      // is drawn on the ink scale, so its left edge is placed on it too —
      // otherwise the mask and the digit come apart as the staff grows.
      primitives.push({
        kind: 'rect',
        x: eventX - (charWidthSp / 2) * ink,
        y: stringY - bgHeight / 2,
        w: charWidthSp,
        h: bgHeight,
        fill: FRET_BG_FILL,
        className: 'fret-bg',
        sourceId: noteId
      });
      primitives.push({
        kind: 'text',
        text: fretStr,
        x: eventX,
        y: stringY,
        font: 'body',
        size: fontSize,
        anchor: 'middle',
        baseline: 'central',
        weight: FRET_FONT_WEIGHT,
        fill: fretFill,
        className: 'fret-number' +
          (isActive ? ' active' : '') +
          (isSelected ? ' selected' : ''),
        sourceId: noteId
      });
    }

    if (primaryNoteId) {
      index.set(primaryNoteId, { measureIndex, voiceIndex, eventIndex });
      // Also index the chord notes — they all click-target the same event.
      for (const id of noteIds) {
        if (id !== undefined && id !== primaryNoteId && !index.has(id)) {
          index.set(id, { measureIndex, voiceIndex, eventIndex });
        }
      }
    }
  };

  voices.forEach((sequence, voiceIndex) => {
    sequence.content.forEach((item, eventIndex) => {
      const slot = slots[voiceIndex]?.[eventIndex];
      if (!slot) return;
      const voiceKey = `${voiceIndex}`;
      // The item's own duration, in x: where the next column starts, or the
      // bar's end barline. A vibrato wiggle and a bend curve draw across it.
      const itemEndX = slots[voiceIndex]?.[eventIndex + 1]?.x ?? measureEndX;

      // Containers hold events, and the plan reserved ONE slot for the whole
      // container — its first inner column. The inner columns are then walked
      // exactly as the notation layout walks them (`emitTupletGroup`,
      // `emitGraceGroup`), because both staves read the one plan and a walk
      // that disagreed with it by a term would slide the tab out of column.
      if (isGrace(item) || isTuplet(item)) {
        const inner = innerColumns(item, slot.x, ink, accidentalContext);
        inner.forEach(({ event, x, endX }, containerIndex) => {
          try {
            drawEvent({
              event,
              eventIndex,
              containerIndex,
              eventX: x,
              eventEndX: endX,
              // A grace is small on tab for the same reason it is small on the
              // notation staff: it is an ornament, and a full-size digit would
              // read as part of the beat it decorates.
              scale: isGrace(item) ? GRACE_FRET_SCALE : 1,
              voiceKey,
              // Un-timed events take no technique ordinal: the ordinals number
              // the beats a technique can travel between, and a grace is not
              // one of them.
              ordinal: isGrace(item) ? -1 : nextOrdinal(techniqueSites, voiceKey),
              voiceIndex
            });
          } catch (e) {
            onIssue((e as Error).message);
          }
        });
        if (isTuplet(item) && showTupletBrackets && inner.length > 0) {
          emitTabTupletBracket(
            item,
            inner[0].x,
            inner[inner.length - 1].x,
            staffTop,
            primitives
          );
        }
        return;
      }

      // Tremolos still aren't drawn on tab — the plan reserves their columns,
      // so the staves stay aligned in the "both" view. Unknown item kinds were
      // recorded by the plan.
      if (!isTimedEvent(item)) return;

      try {
        drawEvent({
          event: item,
          eventIndex,
          eventX: slot.x,
          eventEndX: itemEndX,
          scale: 1,
          voiceKey,
          ordinal: nextOrdinal(techniqueSites, voiceKey),
          voiceIndex
        });
      } catch (e) {
        onIssue((e as Error).message);
      }
    });
  });
}