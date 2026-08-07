import { MnxStructure, isTimedEvent } from '../../model/mnx.ts';
import { resolveEventPositions } from '../tab/guitarPositions.ts';
import { Primitive, LayoutResult, LayoutDiagnostic, SpatialIndex } from '../primitives.ts';
import { syntheticNoteKey } from '../../model/noteKeys.ts';
import { planHorizontal, staffOneSequences } from './spacing.ts';
import { emitMeasureDiagnostics, MeasureIssue } from './diagnostics.ts';
import { validateDocument } from './validate.ts';

/**
 * Pure layout function for guitar tab. Takes parsed MNX + viewport width
 * (in staff spaces) and returns a primitive list plus a sourceId→location
 * index. Knows nothing about the DOM or pixels.
 *
 * Coordinate system: y increases downward; the staff origin for a system
 * is the y of its top string line. A tab staff has 6 strings 1 sp apart,
 * so the bottom string is 5 sp below the top.
 */

// ---------- Layout constants (all in staff spaces) ----------

const STAFF_LINES = 6;
const STAFF_HEIGHT_SP = STAFF_LINES - 1;          // 5 sp from top string to bottom string

const ROW_PAD_TOP_SP = 4;
const ROW_PAD_BOTTOM_SP = 4;
const ROW_HEIGHT_SP = STAFF_HEIGHT_SP + ROW_PAD_TOP_SP + ROW_PAD_BOTTOM_SP;
const MARGIN_SP = 2;

const STAFF_LINE_THICKNESS_SP = 0.1;
const BARLINE_THICKNESS_SP = 0.1;
const FINAL_BARLINE_THICK_WIDTH_SP = 0.4;
const FINAL_BARLINE_GAP_SP = 0.3;

const FRET_FONT_SIZE_SP = 1.1;

const ACTIVE_COLOR = 'oklch(0.65 0.22 274)';
const SELECTED_COLOR = 'oklch(0.7 0.15 190)';
// The fret digit's backing rect masks the string line under it, so it must be
// the SCORE PAPER colour — which never inverts with the theme — not the app
// chrome (`--bg-app`, which is dark in dark mode and undefined in the standalone
// preview/embed, where it falls back to black and hides the digit). Carries the
// paper token's own fallback so it resolves even where `--paper` isn't defined.
const FRET_BG_FILL = 'var(--paper, oklch(0.985 0.006 85))';

// ---------- Public API ----------

export interface LayoutTabOptions {
  mnx: MnxStructure;
  /** Total available viewport width in staff spaces. */
  widthSp: number;
  activeNoteIds?: readonly string[];
  selectedNoteIds?: readonly string[];
}

export function layoutTab(opts: LayoutTabOptions): LayoutResult {
  const { mnx, widthSp } = opts;
  const activeNoteIds = opts.activeNoteIds ?? [];
  const selectedNoteIds = opts.selectedNoteIds ?? [];

  const primitives: Primitive[] = [];
  const index: SpatialIndex = new Map();

  const diagnostics: LayoutDiagnostic[] = [];

  const part = mnx.parts?.[0];
  if (!part) {
    return { primitives, widthSp, heightSp: ROW_HEIGHT_SP + 2 * MARGIN_SP, usedWidthSp: widthSp, index, diagnostics };
  }

  const numMeasures = part.measures.length;
  // All horizontal decisions (system packing, bar widths, event x positions)
  // come from the shared plan — layoutNotation consumes the same one, which is
  // what keeps notation and tab column-aligned in the "both" view.
  const plan = planHorizontal(mnx, widthSp);

  // Semantic validation (user-fixable, e.g. bar duration arithmetic) — merged
  // into each measure's diagnostic markers alongside renderer-gap issues.
  // Unlike the notation staff, this one KEEPS `scope: 'tab'` issues — the
  // fingerboard constraints they describe are exactly what this view draws.
  const validationByMeasure = new Map<number, MeasureIssue[]>();
  for (const v of validateDocument(mnx)) {
    const list = validationByMeasure.get(v.measureIndex) ?? [];
    list.push({ kind: v.severity === 'warning' ? 'warning' : 'validation', message: v.message });
    validationByMeasure.set(v.measureIndex, list);
  }

  for (let i = 0; i < numMeasures; i++) {
    const partMeasure = part.measures[i] ?? { sequences: [] };
    const m = plan.measures[i];
    const staffTop = MARGIN_SP + m.row * ROW_HEIGHT_SP + ROW_PAD_TOP_SP;
    const staffBottom = staffTop + STAFF_HEIGHT_SP;

    // Staff lines (drawn as primitives — per SMuFL guidance, don't use staff6Lines glyph)
    for (let s = 0; s < STAFF_LINES; s++) {
      const lineY = staffTop + s;
      primitives.push({
        kind: 'line',
        x1: m.x, y1: lineY, x2: m.x + m.width, y2: lineY,
        thickness: STAFF_LINE_THICKNESS_SP,
        className: 'staff-line'
      });
    }

    // System-start barline
    if (m.firstInSystem) {
      primitives.push({
        kind: 'line',
        x1: m.x, y1: staffTop, x2: m.x, y2: staffBottom,
        thickness: BARLINE_THICKNESS_SP,
        className: 'barline barline-start'
      });
    }

    // Tab clef (the notation clef's slot in the shared plan keeps both views aligned)
    if (m.firstInSystem) {
      primitives.push({
        kind: 'glyph',
        glyph: '6stringTabClef',
        x: m.clefX,
        y: staffTop + STAFF_HEIGHT_SP / 2,
        className: 'tab-clef'
      });
    }

    // Time signature (digits centred in upper and lower halves of the staff)
    if (m.showTimeSig) {
      const numCenterY = staffTop + STAFF_HEIGHT_SP / 4;
      const denCenterY = staffTop + (3 * STAFF_HEIGHT_SP) / 4;

      // SMuFL time-sig digits have their alphabetic baseline at the visual
      // centre of the digit, so y = centre directly.
      for (const digit of String(m.timeSig.count)) {
        primitives.push({
          kind: 'glyph',
          glyph: 'timeSig' + digit,
          x: m.timeSigCentreX,
          y: numCenterY,
          anchor: 'middle',
          className: 'time-sig-num'
        });
      }
      for (const digit of String(m.timeSig.unit)) {
        primitives.push({
          kind: 'glyph',
          glyph: 'timeSig' + digit,
          x: m.timeSigCentreX,
          y: denCenterY,
          anchor: 'middle',
          className: 'time-sig-den'
        });
      }
    }

    // Events per voice (staff 1 only — the same filter the plan was built from)
    const stdSequences = staffOneSequences(partMeasure.sequences);

    // Validation issues (user-fixable), the plan's issues (unsupported items),
    // plus anything an individual event throws (forgiving render) — one bad
    // event must not take down the bar.
    const measureIssues: MeasureIssue[] = [
      ...(validationByMeasure.get(i) ?? []),
      ...m.issues.map(message => ({ kind: 'render' as const, message }))
    ];

    // A note written in two voices at one fingerboard position is ONE note.
    // Both copies land on the same digit, so drawing the second is redundant
    // (and doubles the glyph's anti-aliasing). Keyed by column + string + fret,
    // so a genuine conflict — different frets, one string — still draws both
    // and stays visible next to its red badge.
    const drawnFrets = new Set<string>();
    stdSequences.forEach((sequence, voiceIndex) => {
      sequence.content.forEach((event, eventIndex) => {
        const slot = m.voices[voiceIndex]?.[eventIndex];
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
          const positions = resolveEventPositions(event.notes);
          // Per-note selection keys: real ids, or synthesized positional keys
          // for id-less documents (see src/utils/noteKeys.ts).
          const noteIds = event.notes.map(
            (n, idx) => n.id ?? syntheticNoteKey(i, voiceIndex, eventIndex, idx)
          );
          const primaryNoteId = noteIds[0];

          for (let k = 0; k < positions.length; k++) {
            const pos = positions[k];
            const noteId = noteIds[k] ?? primaryNoteId;

            // Per NOTE, not per event: the editor's cursor is one note of a
            // chord, and highlighting the whole event would erase it.
            const isActive = activeNoteIds.includes(noteId);
            const isSelected = selectedNoteIds.includes(noteId);
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
              measureIndex: i,
              voiceIndex,
              eventIndex
            });
            // Also index the chord notes — they all click-target the same event.
            for (const id of noteIds) {
              if (id !== primaryNoteId && !index.has(id)) {
                index.set(id, { measureIndex: i, voiceIndex, eventIndex });
              }
            }
          }
        }
        } catch (e) {
          measureIssues.push({ kind: 'render', message: (e as Error).message });
        }
      });
    });

    // End barline
    const isLast = i === numMeasures - 1;
    const barX = m.x + m.width;
    if (isLast) {
      const thinX = barX - FINAL_BARLINE_THICK_WIDTH_SP - FINAL_BARLINE_GAP_SP;
      primitives.push({
        kind: 'line',
        x1: thinX, y1: staffTop, x2: thinX, y2: staffBottom,
        thickness: BARLINE_THICKNESS_SP,
        className: 'barline barline-final-thin'
      });
      primitives.push({
        kind: 'rect',
        x: barX - FINAL_BARLINE_THICK_WIDTH_SP, y: staffTop,
        w: FINAL_BARLINE_THICK_WIDTH_SP, h: STAFF_HEIGHT_SP,
        fill: 'currentColor',
        className: 'barline barline-final-thick'
      });
    } else {
      primitives.push({
        kind: 'line',
        x1: barX, y1: staffTop, x2: barX, y2: staffBottom,
        thickness: BARLINE_THICKNESS_SP,
        className: 'barline'
      });
    }

    if (measureIssues.length) {
      emitMeasureDiagnostics(m.x, staffBottom, measureIssues, primitives);
      for (const issue of measureIssues) diagnostics.push({ measureIndex: i, ...issue });
    }
  }

  const heightSp = 2 * MARGIN_SP + Math.max(1, plan.rowCount) * ROW_HEIGHT_SP;

  return { primitives, widthSp, heightSp, usedWidthSp: plan.usedWidthSp, index, diagnostics };
}
