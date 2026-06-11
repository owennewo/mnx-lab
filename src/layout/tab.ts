import { MnxStructure } from '../types/mnx.ts';
import { resolveEventPositions } from '../tab/guitarPositions.ts';
import { Primitive, LayoutResult, SpatialIndex } from '../primitives.ts';
import { syntheticNoteKey } from '../utils/noteKeys.ts';

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

const START_BARLINE_PAD_SP = 0.5;
const CLEF_WIDTH_SP = 3.5;
const TIME_SIG_WIDTH_SP = 2.5;
const CONTENT_LEFT_PAD_SP = 0.5;
const CONTENT_RIGHT_PAD_SP = 0.6;

const FRET_FONT_SIZE_SP = 1.1;

const ACTIVE_COLOR = 'oklch(0.65 0.22 274)';
const SELECTED_COLOR = 'oklch(0.7 0.15 190)';
const FRET_BG_FILL = 'var(--bg-app)';

// ---------- Duration arithmetic ----------

const DURATION_BASE_VALUE: Record<string, number> = {
  whole: 1,
  half: 0.5,
  quarter: 0.25,
  eighth: 0.125,
  sixteenth: 0.0625,
  'thirty-second': 0.03125
};

function durationValue(d: { base: string; dots?: number }): number {
  const base = DURATION_BASE_VALUE[d.base] ?? 0.25;
  const dots = d.dots ?? 0;
  if (dots === 0) return base;
  return base * (2 - 1 / Math.pow(2, dots));
}

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

  const part = mnx.parts?.[0];
  if (!part) {
    return { primitives, widthSp, heightSp: ROW_HEIGHT_SP + 2 * MARGIN_SP, index };
  }

  const numMeasures = part.measures.length;
  const measuresPerRow = widthSp > 80 ? 4 : 2;
  const measureAllocatedWidth = (widthSp - 2 * MARGIN_SP) / measuresPerRow;

  let activeTimeSig = { count: 4, unit: 4 };

  for (let i = 0; i < numMeasures; i++) {
    const globalMeasure = mnx.global.measures[i] ?? {};
    const partMeasure = part.measures[i] ?? { sequences: [] };

    let timeSigChanged = false;
    if (globalMeasure.time) {
      const { count, unit } = globalMeasure.time;
      if (i === 0 || count !== activeTimeSig.count || unit !== activeTimeSig.unit) {
        activeTimeSig = { count, unit };
        if (i > 0) timeSigChanged = true;
      }
    }

    const row = Math.floor(i / measuresPerRow);
    const col = i % measuresPerRow;
    const x = MARGIN_SP + col * measureAllocatedWidth;
    const staffTop = MARGIN_SP + row * ROW_HEIGHT_SP + ROW_PAD_TOP_SP;
    const staffBottom = staffTop + STAFF_HEIGHT_SP;

    const isFirstInSystem = col === 0;
    const showStartBarline = isFirstInSystem;
    const showClef = isFirstInSystem;
    const showTimeSig = i === 0 || timeSigChanged;

    const startBarlinePad = showStartBarline ? START_BARLINE_PAD_SP : 0;
    const clefSpace = showClef ? CLEF_WIDTH_SP : 0;
    const timeSigSpace = showTimeSig ? TIME_SIG_WIDTH_SP : 0;
    const contentStartX =
      x + CONTENT_LEFT_PAD_SP + startBarlinePad + clefSpace + timeSigSpace;
    const contentWidth = x + measureAllocatedWidth - CONTENT_RIGHT_PAD_SP - contentStartX;

    // Staff lines (drawn as primitives — per SMuFL guidance, don't use staff6Lines glyph)
    for (let s = 0; s < STAFF_LINES; s++) {
      const lineY = staffTop + s;
      primitives.push({
        kind: 'line',
        x1: x, y1: lineY, x2: x + measureAllocatedWidth, y2: lineY,
        thickness: STAFF_LINE_THICKNESS_SP,
        className: 'staff-line'
      });
    }

    // System-start barline
    if (showStartBarline) {
      primitives.push({
        kind: 'line',
        x1: x, y1: staffTop, x2: x, y2: staffBottom,
        thickness: BARLINE_THICKNESS_SP,
        className: 'barline barline-start'
      });
    }

    // Tab clef
    if (showClef) {
      primitives.push({
        kind: 'glyph',
        glyph: '6stringTabClef',
        x: x + CONTENT_LEFT_PAD_SP + startBarlinePad,
        y: staffTop + STAFF_HEIGHT_SP / 2,
        className: 'tab-clef'
      });
    }

    // Time signature (digits centred in upper and lower halves of the staff)
    if (showTimeSig) {
      const tsX =
        x + CONTENT_LEFT_PAD_SP + startBarlinePad + clefSpace +
        TIME_SIG_WIDTH_SP / 2;
      const numCenterY = staffTop + STAFF_HEIGHT_SP / 4;
      const denCenterY = staffTop + (3 * STAFF_HEIGHT_SP) / 4;

      // SMuFL time-sig digits have their alphabetic baseline at the visual
      // centre of the digit, so y = centre directly.
      for (const digit of String(activeTimeSig.count)) {
        primitives.push({
          kind: 'glyph',
          glyph: 'timeSig' + digit,
          x: tsX,
          y: numCenterY,
          anchor: 'middle',
          className: 'time-sig-num'
        });
      }
      for (const digit of String(activeTimeSig.unit)) {
        primitives.push({
          kind: 'glyph',
          glyph: 'timeSig' + digit,
          x: tsX,
          y: denCenterY,
          anchor: 'middle',
          className: 'time-sig-den'
        });
      }
    }

    // Events per voice (staff 1 only — matches current behaviour for merged
    // notation+tab parts where staff 2 is a duplicate)
    const stdSequences = (partMeasure.sequences ?? []).filter(
      seq => seq.staff === 1 || seq.staff === undefined
    );
    const measureDuration = activeTimeSig.count / activeTimeSig.unit;
    // Some MNX data has voices whose event durations sum to more than the
    // declared time signature allows (MusicXML conversion artifacts). To keep
    // every glyph inside its measure we scale by the longest voice's actual
    // duration when it exceeds the measure duration. Both voices share the
    // same denominator so they stay aligned to each other.
    const voiceTotals = stdSequences.map(seq =>
      seq.content.reduce((sum, ev) => sum + durationValue(ev.duration), 0)
    );
    const effectiveDuration = Math.max(measureDuration, ...voiceTotals);
    if (effectiveDuration > measureDuration) {
      console.warn(
        `[tab] measure ${i}: voice durations exceed time signature ` +
        `(max=${effectiveDuration} vs ${measureDuration}). Squeezing to fit.`
      );
    }

    stdSequences.forEach((sequence, voiceIndex) => {
      let cumDuration = 0;
      sequence.content.forEach((event, eventIndex) => {
        const eventDur = durationValue(event.duration);
        // Zone-based (centre-of-slot) positioning: each event occupies a zone
        // of width = duration / effectiveDuration; the glyph sits at the
        // centre of its zone.
        const centreFraction = effectiveDuration > 0
          ? (cumDuration + eventDur / 2) / effectiveDuration
          : 0;
        const eventX = contentStartX + centreFraction * contentWidth;

        if (event.rest) {
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

          const isActive = noteIds.some(id => activeNoteIds.includes(id));
          const isSelected = noteIds.some(id => selectedNoteIds.includes(id));
          const fretFill = isActive ? ACTIVE_COLOR : isSelected ? SELECTED_COLOR : undefined;

          for (let k = 0; k < positions.length; k++) {
            const pos = positions[k];
            const noteId = noteIds[k] ?? primaryNoteId;
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

        cumDuration += eventDur;
      });
    });

    // End barline
    const isLast = i === numMeasures - 1;
    const barX = x + measureAllocatedWidth;
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
  }

  const totalRows = Math.ceil(numMeasures / measuresPerRow);
  const heightSp = 2 * MARGIN_SP + totalRows * ROW_HEIGHT_SP;

  return { primitives, widthSp, heightSp, index };
}
