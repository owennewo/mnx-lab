import { MnxSequence, isTimedEvent } from '../../model/mnx.ts';
import { resolveEventPositions, TabPositionContext, tabPositionContext } from '../tab/guitarPositions.ts';
import { Primitive, SpatialIndex } from '../primitives.ts';
import { syntheticNoteKey } from '../../model/noteKeys.ts';
import { EventSlot } from './spacing.ts';

/**
 * The tab STAFF: everything needed to draw six string lines, the TAB clef,
 * the tab-style time signature and fret digits — shared verbatim between the
 * standalone tab layout (src/engine/layout/tab.ts) and the notation layout's
 * native tab staff kind in the combined `both` system
 * (roadmap/inprogress/both-view-single-system.md phase 2). One source, so the
 * standalone view and the combined system cannot drift; the tab goldens pin
 * this module through tab.ts byte-for-byte.
 */

// ---------- Tab staff geometry (staff spaces) ----------

export const TAB_STAFF_LINES = 6;
export const TAB_STAFF_HEIGHT_SP = TAB_STAFF_LINES - 1; // 5 sp, top to bottom string

export const TAB_STAFF_LINE_THICKNESS_SP = 0.1;

const FRET_FONT_SIZE_SP = 1.1;

const ACTIVE_COLOR = 'oklch(0.65 0.22 274)';
const SELECTED_COLOR = 'oklch(0.7 0.15 190)';
// The fret digit's backing rect masks the string line under it, so it must be
// the SCORE PAPER colour — which never inverts with the theme — not the app
// chrome (`--bg-app`, which is dark in dark mode and undefined in the standalone
// preview/embed, where it falls back to black and hides the digit). Carries the
// paper token's own fallback so it resolves even where `--paper` isn't defined.
const FRET_BG_FILL = 'var(--paper, oklch(0.985 0.006 85))';

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
    const lineY = staffTop + s;
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
   * The part's effective string set (declared strings or the standard-guitar
   * default, capo applied) — the derivation context for every fret drawn.
   * Optional only for compatibility; omitting it means standard tuning, no capo.
   */
  positionContext?: TabPositionContext;
}

/**
 * Fret digits (with their string-line knock-out rects) for one measure of one
 * tab staff, plus index entries for click/highlight.
 */
export function emitTabVoices(args: EmitTabVoicesArgs): void {
  const {
    voices, slots, staffTop, measureIndex,
    activeNoteIds, selectedNoteIds, synthesizeKeys, primitives, index, onIssue
  } = args;
  const positionContext = args.positionContext ?? tabPositionContext(undefined);

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
          n.id ?? (synthesizeKeys
            ? syntheticNoteKey(measureIndex, voiceIndex, eventIndex, idx)
            : undefined)
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

          const stringY = staffTop + (pos.str - 1);
          const fretStr = String(pos.fret);
          const charWidthSp = FRET_FONT_SIZE_SP * 0.6 * Math.max(1, fretStr.length);

          // Background rect obscures the staff line under the digit
          primitives.push({
            kind: 'rect',
            x: eventX - charWidthSp / 2,
            y: stringY - 0.5,
            w: charWidthSp,
            h: 1,
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
            weight: 600,
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
