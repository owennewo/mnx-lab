import { MnxSequence, isTimedEvent } from '../../model/mnx.ts';
import {
  GUITAR_TUNING,
  midiOfMnxPitch,
  resolveEventPositions,
  TabPositionContext
} from '../tab/guitarPositions.ts';
import { Primitive, SpatialIndex } from '../primitives.ts';
import { noteKeyAt } from '../../model/noteWalk.ts';
import { EventSlot } from './spacing.ts';

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
  primitives: Primitive[]
): void {
  const capo = ctx.capo;
  if (capo > 0) {
    primitives.push({
      kind: 'text',
      text: `Capo ${capo}`,
      x: x + CAPO_INSET_SP,
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
      x: x - TUNING_LETTER_INSET_SP,
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
}

/**
 * Fret digits (with their string-line knock-out rects) for one measure of one
 * tab staff, plus index entries for click/highlight.
 */
export function emitTabVoices(args: EmitTabVoicesArgs): void {
  const {
    voices, slots, staffTop, measureIndex, positionContext,
    activeNoteIds, selectedNoteIds, synthesizeKeys, primitives, index, onIssue
  } = args;

  // A note written in two voices at one fingerboard position is ONE note.
  // Both copies land on the same digit, so drawing the second is redundant
  // (and doubles the glyph's anti-aliasing). Keyed by column + string + fret,
  // so a genuine conflict — different frets, one string — still draws both
  // and stays visible next to its red badge.
  const drawnFrets = new Set<string>();
  voices.forEach((sequence, voiceIndex) => {
    sequence.content.forEach((event, eventIndex) => {
      const slot = slots[voiceIndex]?.[eventIndex];
      if (!slot) return;
      const eventX = slot.x;

      try {
      // Grace notes and tremolos aren't drawn on tab yet — the plan still
      // reserves their columns, so the staves stay aligned in the "both"
      // view. Unknown item kinds (tuplet, …) were recorded by the plan.
      if (!isTimedEvent(event)) {
        // skip
      } else if (event.rest) {
        // Tab convention: rests in tab-only view consume time but aren't
        // drawn. (When tab pairs with a notation staff, rests live there.)
      } else if (event.notes && event.notes.length > 0) {
        const positions = resolveEventPositions(event.notes, positionContext);
        // Per-note selection keys: real ids, or synthesized positional keys
        // for id-less documents (see src/utils/noteKeys.ts).
        const noteIds = event.notes.map((n, idx) =>
          synthesizeKeys ? noteKeyAt(n, measureIndex, voiceIndex, eventIndex, idx) : n.id
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
          const fretStr = String(pos.fret);
          const charWidthSp = FRET_FONT_SIZE_SP * 0.6 * Math.max(1, fretStr.length);

          // Background rect obscures the staff line under the digit
          primitives.push({
            kind: 'rect',
            x: eventX - charWidthSp / 2,
            y: stringY - FRET_BG_HEIGHT_SP / 2,
            w: charWidthSp,
            h: FRET_BG_HEIGHT_SP,
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
            size: FRET_FONT_SIZE_SP,
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
          index.set(primaryNoteId, {
            measureIndex,
            voiceIndex,
            eventIndex
          });
          // Also index the chord notes — they all click-target the same event.
          for (const id of noteIds) {
            if (id !== undefined && id !== primaryNoteId && !index.has(id)) {
              index.set(id, { measureIndex, voiceIndex, eventIndex });
            }
          }
        }
      }
      } catch (e) {
        onIssue((e as Error).message);
      }
    });
  });
}
