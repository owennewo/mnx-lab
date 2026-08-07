import { MnxStructure } from '../../model/mnx.ts';
import { Primitive, LayoutResult, LayoutDiagnostic, RowBandSp, SpatialIndex } from '../primitives.ts';
import { planHorizontal, staffOneSequences } from './spacing.ts';
import { emitMeasureDiagnostics, MeasureIssue } from './diagnostics.ts';
import {
  TAB_STAFF_HEIGHT_SP,
  emitTabClef,
  emitTabStaffLines,
  emitTabTimeSig,
  emitTabVoices
} from './tabStaff.ts';
import { validateDocument } from './validate.ts';
import { tabPositionContext } from '../tab/guitarPositions.ts';

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
// Staff geometry and fret emission live in tabStaff.ts, shared with the
// notation layout's native tab staff kind — only the standalone view's own
// row/barline framing stays here.

const STAFF_HEIGHT_SP = TAB_STAFF_HEIGHT_SP;      // 5 sp from top string to bottom string

const ROW_PAD_TOP_SP = 4;
const ROW_PAD_BOTTOM_SP = 4;
const ROW_HEIGHT_SP = STAFF_HEIGHT_SP + ROW_PAD_TOP_SP + ROW_PAD_BOTTOM_SP;
const MARGIN_SP = 2;

const BARLINE_THICKNESS_SP = 0.1;
const FINAL_BARLINE_THICK_WIDTH_SP = 0.4;
const FINAL_BARLINE_GAP_SP = 0.3;

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

  const rowBand = (row: number): RowBandSp => {
    const staffTop = MARGIN_SP + row * ROW_HEIGHT_SP + ROW_PAD_TOP_SP;
    return { staffTop, staffBottom: staffTop + STAFF_HEIGHT_SP };
  };

  const part = mnx.parts?.[0];
  if (!part) {
    return {
      primitives, widthSp, heightSp: ROW_HEIGHT_SP + 2 * MARGIN_SP,
      usedWidthSp: widthSp, index, diagnostics, rows: [rowBand(0)]
    };
  }

  const numMeasures = part.measures.length;
  // Effective string set (declared or standard-guitar default, capo applied) —
  // one context for every fret this layout derives.
  const positionContext = tabPositionContext(part);
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

    emitTabStaffLines(m.x, m.width, staffTop, primitives);

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
      emitTabClef(m.clefX, staffTop, primitives);
    }

    // Time signature (digits centred in upper and lower halves of the staff)
    if (m.showTimeSig) {
      emitTabTimeSig(m.timeSig, m.timeSigCentreX, staffTop, primitives);
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

    emitTabVoices({
      voices: stdSequences,
      slots: m.voices,
      staffTop,
      measureIndex: i,
      activeNoteIds,
      selectedNoteIds,
      // This layout IS the staff-1-of-first-part traversal jsonView mirrors.
      synthesizeKeys: true,
      primitives,
      index,
      onIssue: message => measureIssues.push({ kind: 'render', message }),
      positionContext
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
  const rows = Array.from({ length: Math.max(1, plan.rowCount) }, (_, r) => rowBand(r));

  return { primitives, widthSp, heightSp, usedWidthSp: plan.usedWidthSp, index, diagnostics, rows };
}
