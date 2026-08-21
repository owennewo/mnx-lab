import { MnxStructure } from '../../model/mnx.ts';
import { Primitive, LayoutResult, LayoutDiagnostic, RowBandSp, SpatialIndex } from '../primitives.ts';
import { planHorizontal, staffOneSequences } from './spacing.ts';
import { emitMeasureDiagnostics, emitPositionedDiagnostics, MeasureIssue } from './diagnostics.ts';
import {
  TAB_STAFF_HEIGHT_SP,
  emitTabClef,
  emitTabStaffLines,
  emitTabSystemHeader,
  emitTabTimeSig,
  emitTabVoices
} from './tabStaff.ts';
import { emitEndBarline, resolveBarlineType, type BarlineMetrics } from './barlines.ts';
import { emitNavigationMarkers, emitScoreLabels, emitTempoMark } from './scoreText.ts';
import { clampPadDensity, ensureTopMargin, tightenRows } from './verticalDensity.ts';
import { validateDocument } from './validate.ts';
import { tabPositionContext, PartTabSetups } from '../tab/guitarPositions.ts';

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

const STAFF_HEIGHT_SP = TAB_STAFF_HEIGHT_SP;      // top string to bottom string

// The PROVISIONAL frame around a tab staff. 4/4 → 2/2 → 3/3, all on
// 2026-08-21 and all by eye: a tab staff has no stems, so 8sp between bare
// staves read as abandoned and 4sp read as crowded. 6sp is where it settled.
// Safe at any of them because the frame is no longer the answer:
// `tightenRows` widens any row whose ink overruns it (a capo line, a label
// stack), and `ensureTopMargin` keeps the first row on the page.
const ROW_PAD_TOP_SP = 3;
const ROW_PAD_BOTTOM_SP = 3;
const ROW_HEIGHT_SP = STAFF_HEIGHT_SP + ROW_PAD_TOP_SP + ROW_PAD_BOTTOM_SP;
const MARGIN_SP = 2;

const BARLINE_THICKNESS_SP = 0.1;
const FINAL_BARLINE_THICK_WIDTH_SP = 0.4;
const FINAL_BARLINE_GAP_SP = 0.3;
const BARLINE_METRICS: BarlineMetrics = {
  thinSp: BARLINE_THICKNESS_SP,
  thickSp: FINAL_BARLINE_THICK_WIDTH_SP,
  gapSp: FINAL_BARLINE_GAP_SP
};

// ---------- Public API ----------

export interface LayoutTabOptions {
  mnx: MnxStructure;
  /** Total available viewport width in staff spaces. */
  widthSp: number;
  activeNoteIds?: readonly string[];
  selectedNoteIds?: readonly string[];
  /** Viewer-supplied instrument (strings/capo) — overrides the document's
   *  declaration for rendering; never written back. */
  tabSetup?: PartTabSetups;
  /** Horizontal density multiplier (core-render-density-zoom.md) — the same
   *  spring scaling notation gets. The standalone tab view shipped without
   *  this and so ignored `density` entirely; core-zoom-density-pad.md found
   *  it when the pad had to drive all three views. */
  densityH?: number;
  /** Vertical/frame density (core-vertical-density.md). A tab staff reserves
   *  4sp above it and uses a median of 0.0 — this is the view the axis was
   *  measured on and buys the most. */
  densityPad?: number;
  /** Ink ratio (core-ink-priced-columns.md): the paint's `pxPerSpY/pxPerSp`.
   *  Rigid columns are ink and re-price by it; packing stays square.
   *  1/unset = today's layout, untouched. */
  inkRatio?: number;
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
  // Effective string set (document declaration, unless the viewer overrides;
  // capo applied) — one context for every fret this layout derives. Null when
  // no strings are known ANYWHERE: no instrument is assumed, so the staff
  // renders bare (lines/clef/time, no frets) and validate.ts badges the ask.
  const positionContext = tabPositionContext(part, opts.tabSetup);
  // All horizontal decisions (system packing, bar widths, event x positions)
  // come from the shared plan — layoutNotation consumes the same one, which is
  // what keeps notation and tab column-aligned in the "both" view.
  // `staffKind: 'tab'` — this is the STANDALONE tab view, so the prefix
  // reserves no key-signature column (a tab staff draws none) and sizes the
  // clef slot for the tab clef. The `both` view goes through layoutNotation
  // instead, where the tab staff shares a system with a notation staff that
  // does draw one, and must keep agreeing with its columns.
  const plan = planHorizontal(mnx, widthSp, {
    densityH: opts.densityH,
    densityPad: opts.densityPad,
    inkRatio: opts.inkRatio,
    staffKind: 'tab'
  });

  // Semantic validation (user-fixable, e.g. bar duration arithmetic) — merged
  // into each measure's diagnostic markers alongside renderer-gap issues.
  // Unlike the notation staff, this one KEEPS `scope: 'tab'` issues — the
  // fingerboard constraints they describe are exactly what this view draws.
  type AnchoredIssue = MeasureIssue & { at?: { voiceIndex: number; eventIndex: number } };
  const validationByMeasure = new Map<number, AnchoredIssue[]>();
  for (const v of validateDocument(mnx, opts.tabSetup)) {
    const list = validationByMeasure.get(v.measureIndex) ?? [];
    list.push({
      kind: v.severity === 'warning' ? 'warning' : 'validation',
      message: v.message,
      ...(v.at ? { at: v.at } : {})
    });
    validationByMeasure.set(v.measureIndex, list);
  }

  // Where each row's primitives begin — rows are emitted in order, so a row's
  // primitives are exactly the slice from its first measure onward.
  const rowStart: number[] = [];
  for (let i = 0; i < numMeasures; i++) {
    const partMeasure = part.measures[i] ?? { sequences: [] };
    const m = plan.measures[i];
    if (rowStart[m.row] === undefined) rowStart[m.row] = primitives.length;
    const staffTop = MARGIN_SP + m.row * ROW_HEIGHT_SP + ROW_PAD_TOP_SP;
    const staffBottom = staffTop + STAFF_HEIGHT_SP;

    emitTabStaffLines(m.x, m.width, staffTop, primitives);

    // Setup instructions — capo text and (non-standard) tuning letters,
    // above/beside the FIRST bar only.
    if (i === 0 && positionContext) {
      emitTabSystemHeader(positionContext, m.x, staffTop, plan.inkRatio, primitives);
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
    // event must not take down the bar. Issues attributable to one event draw
    // UNDER that event's column; the rest stack in the bar corner.
    const fromValidation = validationByMeasure.get(i) ?? [];
    const anchored = fromValidation.filter(
      v => v.at && m.voices[v.at.voiceIndex]?.[v.at.eventIndex]
    );
    const measureIssues: MeasureIssue[] = [
      ...fromValidation.filter(v => !anchored.includes(v)),
      ...m.issues.map(message => ({ kind: 'render' as const, message }))
    ];

    if (positionContext) {
      emitTabVoices({
        voices: stdSequences,
        slots: m.voices,
        staffTop,
        ink: plan.inkRatio,
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
    }

    // Score-wide marks from the GLOBAL measure — the tempo, the navigation
    // marks and the structural labels. They describe the BAR, not a notation
    // staff (MNX gives them a `location`, never a `staff`), so a tab reader is
    // owed them exactly as much: a section name and a D.S. are how you know
    // where you are in the piece, and losing them was losing the map.
    //
    // Same order as the notation layout, and the order matters: labels scan
    // what already sits over this measure and stack above it.
    const gm = mnx.global.measures[i] ?? {};
    // The text clears THIS ROW's ink only; the row above is tightenRows' job.
    const tempoTop = emitTempoMark({
      gm, m, staffTop, scan: primitives.slice(rowStart[m.row]), primitives
    });
    emitNavigationMarkers({ gm, m, stdSequences, staffTop, primitives });
    emitScoreLabels({
      gm, m, staffTop, scan: primitives.slice(rowStart[m.row]), clearAbove: tempoTop, primitives
    });

    // End barline — the global measure's style, defaulted per the spec. A tab
    // staff is owed it for the same reason it is owed a section name: the
    // barline describes the BAR, not a notation staff.
    const isLast = i === numMeasures - 1;
    emitEndBarline({
      type: resolveBarlineType(gm.barline, isLast),
      x: m.x + m.width,
      top: staffTop,
      bottom: staffBottom,
      metrics: BARLINE_METRICS,
      primitives
    });

    if (anchored.length) {
      const bySlot = new Map<number, MeasureIssue[]>();
      for (const v of anchored) {
        const slot = m.voices[v.at!.voiceIndex][v.at!.eventIndex];
        const key = Math.round(slot.x * 1e4);
        bySlot.set(key, [...(bySlot.get(key) ?? []), v]);
      }
      for (const [key, list] of bySlot) {
        emitPositionedDiagnostics(key / 1e4, staffBottom, list, primitives);
      }
      for (const { at: _at, ...issue } of anchored) diagnostics.push({ measureIndex: i, ...issue });
    }
    if (measureIssues.length) {
      emitMeasureDiagnostics(m.x, staffBottom, measureIssues, primitives);
      for (const issue of measureIssues) diagnostics.push({ measureIndex: i, ...issue });
    }
  }

  const baseHeightSp = 2 * MARGIN_SP + Math.max(1, plan.rowCount) * ROW_HEIGHT_SP;
  const baseRows = Array.from({ length: Math.max(1, plan.rowCount) }, (_, r) => rowBand(r));

  // ROW_PAD_TOP_SP is sized for a capo line, and the score-wide labels stack
  // higher than that — a rehearsal box over a metronome mark reaches past the
  // page top and would be quietly clipped. Fit the frame to the ink FIRST, so
  // the density pass below sees a layout whose gaps are all real.
  const fitted = ensureTopMargin(primitives, baseRows, baseHeightSp, MARGIN_SP);
  const heightSp = fitted?.heightSp ?? baseHeightSp;
  const rows = fitted?.rows ?? baseRows;

  const tightened = tightenRows({
    primitives, rows, heightSp, padDensity: clampPadDensity(opts.densityPad)
  });

  return {
    primitives, widthSp, heightSp: tightened?.heightSp ?? heightSp, usedWidthSp: plan.usedWidthSp,
    index, diagnostics, rows: tightened?.rows ?? rows,
    packings: [plan.packing]
  };
}
