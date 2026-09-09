import { qualifyMeasure, qualifyTechniques, performedKeys, writtenIndex, emitOccurrenceLabel } from './unrolled.ts';
import type { PerformedEntry } from '../../model/passes.ts';
import { clearanceSpacing } from '../clearance.ts';
import { emitMultirest } from './multirest.ts';
import type { MnxPart } from '../../model/mnx.ts';
import type { HorizontalPlan, PlanOptions } from './spacing.ts';
import { buildScoreJobs, layoutNotation } from './notation.ts';
import { translatePrimitiveY } from '../primitives.ts';
import { computeBoundsSp } from '../render/bounds.ts';
import { anchorY, rowBoundariesSp } from './verticalDensity.ts';
import { measureHeadingX, instrumentLabelInset, LABEL_PAD_SP } from './spacing.ts';
import { documentLyricLineIds, selectedLyricLineIds } from './lyricRuns.ts';
import { displayedMeasureNumbers, instrumentName, normalizeDisplayOptions, type DisplayOptions } from '../displayOptions.ts';
import { MnxStructure, type MnxEvent, isGrace, isTimedEvent, isTuplet } from '../../model/mnx.ts';
import { Primitive, LayoutResult, LayoutDiagnostic, RowBandSp, SpatialIndex } from '../primitives.ts';
import { clampDensity, planHorizontal, staffOneSequences } from './spacing.ts';
import { emitMeasureDiagnostics, emitPositionedDiagnostics, MeasureIssue } from './diagnostics.ts';
import {
  TAB_STAFF_HEIGHT_SP,
  emitTabClef,
  emitTabStaffLines,
  emitTabSystemHeader,
  emitTabTimeSig,
  emitTabVoices,
  innerColumns
} from './tabStaff.ts';
import {
  LYRIC_FIRST_BASELINE_DROP_SP,
  LYRIC_LINE_SPACING_SP,
  emitLyricRuns,
  lyricBlockSpFor,
  orderedLyricLineIds,
  type LyricSyllable
} from './lyricRuns.ts';
import type { HideableFeature } from './notation.ts';
import { emitMeasureRepeat, measureRepeatX, type MeasureRepeatMark } from './measureRepeat.ts';
import { emitEndings } from './endings.ts';
import { emitDirections, emitDynamics } from './notation.ts';
import {
  emitRepeatDots,
  emitRepeatEndStrokes,
  emitRepeatStartStrokes,
  emitRepeatTimes,
  repeatEndDotDx,
  repeatStartDotDx,
  TAB_REPEAT_DOT_YS
} from './repeats.ts';
import {
  emitEndBarline,
  resolveBarlineType,
  STANDARD_BARLINE_METRICS,
  type BarlineMetrics
} from './barlines.ts';
import { emitHarmonies, emitNavigationMarkers, emitScoreLabels, emitTempoMark, measureOnsetXs } from './scoreText.ts';
import { emitMeasureFermata } from './fermata.ts';
import { emitMeasureNumber } from './arpeggio.ts';
import { ensureTopMargin, fitRowsToClearance, tightenRows } from './verticalDensity.ts';
import { validateDocument } from './validate.ts';
import {
  createTechniqueCollector,
  emitTabTechnique,
  hasTechniqueSites
} from './technique.ts';
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

// Stroke weights are the shared set from barlines.ts — the same tab staff
// must not render lighter here than it does inside the `both` view.
const BARLINE_THICKNESS_SP = STANDARD_BARLINE_METRICS.thinSp;
/** The repeat barlines share the final barline's strokes. */
const REPEAT_METRICS = {
  thick: STANDARD_BARLINE_METRICS.thickSp,
  gap: STANDARD_BARLINE_METRICS.gapSp,
  thin: STANDARD_BARLINE_METRICS.thinSp
};
const BARLINE_METRICS: BarlineMetrics = STANDARD_BARLINE_METRICS;

// ---------- Public API ----------

export interface LayoutTabOptions {
  entries?: PerformedEntry[];
  display?: DisplayOptions;
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
  spacingMode?: 'natural' | 'fill';
  densityH?: number;
  /** Vertical/frame density (core-vertical-density.md). A tab staff reserves
   *  4sp above it and uses a median of 0.0 — this is the view the axis was
   *  measured on and buys the most. */
  densityPad?: number;
  /** Ink ratio (core-ink-priced-columns.md): the paint's `pxPerSpY/pxPerSp`.
   *  Rigid columns are ink and re-price by it; packing stays square.
   *  1/unset = today's layout, untouched. */
  inkRatio?: number;
  /** Features the host asked to hide — honored here so `hide="lyrics"` means
   *  the same thing it means on the notation view. */
  hide?: readonly HideableFeature[];
}

interface TabStaffContext {
  part: MnxPart;
  staffIndex: number;
  plan: HorizontalPlan;
  naturalWidthSp?: number;
  globalLabels: boolean;
  firstScoreSegment: boolean;
  partLabel: boolean;
}

export function layoutTab(opts: LayoutTabOptions): LayoutResult {
  // The no-options entry preserves corpus verdicts. Explicit display controls
  // compose every visible part through the same score jobs and horizontal plan.
  if (opts.display && ((opts.mnx.parts?.length ?? 0) > 1 || opts.mnx.scores?.length || (opts.mnx.parts?.[0]?.staves ?? 1) > 1)) {
    return (opts.mnx.parts ?? []).some(part => tabPositionContext(part, opts.tabSetup) !== null) ? layoutTabSystems(opts) : layoutNotation(opts);
  }
  return layoutTabStaff(opts);
}

function layoutTabStaff(opts: LayoutTabOptions, context?: TabStaffContext): LayoutResult {
  const { mnx, widthSp } = opts;
  const display = normalizeDisplayOptions(opts.display, opts.hide);
  const selectedLyrics = selectedLyricLineIds(mnx, display);
  const measureNumbers = displayedMeasureNumbers(mnx);
  const activeNoteIds = opts.activeNoteIds ?? [];
  const selectedNoteIds = opts.selectedNoteIds ?? [];

  const primitives: Primitive[] = [];
  const index: SpatialIndex = new Map();

  const diagnostics: LayoutDiagnostic[] = [];

  // A tab staff draws no accidentals, but the plan reserves their columns
  // inside a tuplet — so the walk over those columns needs the same answer the
  // plan gave (spacing.ts reads the same flag).
  const useAccidentalDisplay = mnx.mnx?.support?.useAccidentalDisplay === true;

  // The row height this DOCUMENT needs: the frame constant, plus the verse
  // block when lyrics exist — the reservation is explicit, exactly as the
  // notation layout's `lyricExtraSp`, because the fit passes attribute ink
  // to rows by the frame's own bands and cannot grow a row for content that
  // already trespasses into the next one. Assigned once lyricLineIds is
  // known below; every per-row coordinate reads it.
  let rowHeightSp = ROW_HEIGHT_SP;

  const rowBand = (row: number): RowBandSp => {
    const staffTop = MARGIN_SP + row * rowHeightSp + ROW_PAD_TOP_SP;
    return { staffTop, staffBottom: staffTop + STAFF_HEIGHT_SP };
  };

  const part = context?.part ?? mnx.parts?.[0];
  if (!part) {
    return {
      primitives, widthSp, heightSp: ROW_HEIGHT_SP + 2 * MARGIN_SP,
      usedWidthSp: widthSp, index, diagnostics, rows: [rowBand(0)]
    };
  }

  const numMeasures = context?.plan.measures.length ?? opts.entries?.length ?? part.measures.length;
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
  const showNames = display.instrumentNames === 'every-system' || display.instrumentNames === 'first-system';
  const planOptions = {
    entries: opts.entries,
    leftInsetSp: showNames ? instrumentLabelInset([instrumentName(part, true)]) : 0,
    subsequentLeftInsetSp: display.instrumentNames === undefined ? undefined : display.instrumentNames === 'every-system' ? instrumentLabelInset([instrumentName(part, false)]) : 0,
    display,
    lyricLineIds: selectedLyrics,
    spacingMode: opts.spacingMode,
    densityH: opts.densityH,
    densityPad: opts.densityPad,
    inkRatio: opts.inkRatio,
    staffKind: 'tab' as const
  };
  const plan = context?.plan ?? planHorizontal(mnx, widthSp, planOptions);
  // The score's natural extent, for the fit — see `LayoutResult.naturalWidthSp`.
  // Only when density has actually moved: at 1 it is the same number, and the
  // default paint must not pay for a second plan.
  const naturalWidthSp = context ? context.naturalWidthSp :
    clampDensity(opts.densityH) === 1
      ? undefined
      : planHorizontal(mnx, widthSp, { ...planOptions, densityH: 1 }).usedWidthSp;

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

  // Verse rows below the staff (shared rules: lyricRuns.ts). The standalone
  // view draws them itself — it has no notation staff to carry them, the same
  // reasoning as showTupletBrackets — and the shared plan already priced
  // syllable widths into these columns, so nothing moves horizontally. Drawn
  // even with no fingerboard: words are not frets.
  const lyricLineIds = (() => {
    if (selectedLyrics) return selectedLyrics;
    const used = new Set<string>();
    for (const pm of part.measures) {
      for (const seq of (context ? (pm.sequences ?? []).filter(seq => (seq.staff ?? 1) === context.staffIndex) : staffOneSequences(pm.sequences))) {
        for (const item of seq.content) {
          const record = item as { content?: MnxEvent[] };
          const events = isGrace(item) || isTuplet(item) ? (record.content ?? []) : isTimedEvent(item) ? [item as MnxEvent] : [];
          for (const event of events)
            for (const id of Object.keys(event.lyrics?.lines ?? {})) used.add(id);
        }
      }
    }
    return orderedLyricLineIds(mnx, used);
  })();
  const lyricRuns = new Map<string, LyricSyllable[]>();
  // The verse block eats the bottom pad first and claims the rest as extra
  // row height, so the system below starts clear of the words.
  const lyricBlockSp = lyricBlockSpFor(lyricLineIds.length);
  rowHeightSp += Math.max(0, lyricBlockSp - ROW_PAD_BOTTOM_SP);

  // Playing technique is drawn AFTER the measure walk: a hammer-on names its
  // destination by note id, and that note may be measures away — so the marks
  // wait until every digit's geometry is known.
  const technique = createTechniqueCollector();
  const rowEdges = new Map<number, { left: number; right: number }>();

  // Where each row's primitives begin — rows are emitted in order, so a row's
  // primitives are exactly the slice from its first measure onward.
  const rowStart: number[] = [];
  for (let i = 0; i < numMeasures; i++) {
    const partMeasure = part.measures[writtenIndex(plan, i)] ?? { sequences: [] };
    const m = plan.measures[i];
    if (m.hidden) continue;
    const measurePrimitiveStart = primitives.length;
    if (rowStart[m.row] === undefined) {
      rowStart[m.row] = primitives.length;
      // This row's voltas first, so the labels placed below scan them as ink
      // and stack above (core-measure-attributes-gaps.md, item 5).
      if (!m.entry && (!context || context.globalLabels)) emitEndings(mnx, plan, row => MARGIN_SP + row * rowHeightSp + ROW_PAD_TOP_SP, primitives, m.row);
    }
    const edges = rowEdges.get(m.row);
    rowEdges.set(m.row, {
      left: Math.min(edges?.left ?? Infinity, m.contentStartX),
      right: Math.max(edges?.right ?? -Infinity, m.x + m.width)
    });
    const staffTop = MARGIN_SP + m.row * rowHeightSp + ROW_PAD_TOP_SP;
    const staffBottom = staffTop + STAFF_HEIGHT_SP;

    emitTabStaffLines(m.x, m.width, staffTop, primitives);
    if (m.firstInSystem && showNames && context?.partLabel !== false && (display.instrumentNames === 'every-system' || (m.row === 0 && context?.firstScoreSegment !== false))) {
      const name = instrumentName(part, m.row === 0 && context?.firstScoreSegment !== false);
      if (name) primitives.push({ kind: 'text', text: name, x: m.x - LABEL_PAD_SP,
        y: staffTop + STAFF_HEIGHT_SP / 2 + 0.6, font: 'body', size: 1.6,
        anchor: 'end', className: 'staff-label' });
    }

    // Setup instructions — capo text and (non-standard) tuning letters,
    // above/beside the FIRST bar only.
    if (i === 0 && positionContext) {
      emitTabSystemHeader(positionContext, m.x, staffTop, plan.inkRatio, primitives, measureHeadingX(m));
    }

    // An opening repeat at the left edge supplies the system-start strokes.
    if (m.firstInSystem && !(m.repeatStart && m.repeatStartX === m.x)) {
      primitives.push({
        kind: 'line',
        x1: m.x, y1: staffTop, x2: m.x, y2: staffBottom,
        thickness: BARLINE_THICKNESS_SP,
        className: 'barline barline-start'
      });
    }

    // Forward repeat |: — the same strokes and dots the both-view tab staff
    // gets (core-measure-attributes-gaps.md, item 5: this view drew nothing).
    if (m.repeatStart) {
      emitRepeatStartStrokes(m.repeatStartX, staffTop, staffBottom, REPEAT_METRICS, primitives);
      emitRepeatDots(m.repeatStartX, repeatStartDotDx(REPEAT_METRICS), staffTop, TAB_REPEAT_DOT_YS, primitives);
    }

    // Tab clef (the notation clef's slot in the shared plan keeps both views aligned)
    if (m.firstInSystem && display.clefs !== 'hide') {
      emitTabClef(m.clefX, staffTop, primitives);
    }

    // Time signature (digits centred in upper and lower halves of the staff)
    if (m.showTimeSig) {
      emitTabTimeSig(m.timeSig, m.timeSigCentreX, staffTop, primitives);
    }

    // A measure repeat: the sign on the tab staff, labels included — this
    // view has no notation staff to carry them.
    const repeatMark = (partMeasure as { measureRepeat?: MeasureRepeatMark }).measureRepeat;
    if (repeatMark) {
      const spanEnd = plan.measures[i + Math.max(1, repeatMark.number) - 1];
      emitMeasureRepeat({
        mark: repeatMark,
        x: measureRepeatX(repeatMark.number, m, spanEnd && spanEnd.row === m.row ? spanEnd.x + spanEnd.width : undefined),
        staffTop,
        staffHeight: STAFF_HEIGHT_SP,
        labels: true,
        primitives
      });
    }

    if (m.multiRest) emitMultirest(m, [staffTop + 0.5], primitives);

    // Events per voice (staff 1 only — the same filter the plan was built from)
    const stdSequences = m.multiRest ? [] : (context ? (partMeasure.sequences ?? []).filter(seq => (seq.staff ?? 1) === context.staffIndex) : staffOneSequences(partMeasure.sequences));

    // Gather this bar's syllables at their plan columns — the same
    // event↔slot pairing emitTabVoices walks, containers through the same
    // innerColumns the digits use, so words sit exactly under their frets.
    if (lyricLineIds.length > 0) {
      const addSyllables = (event: MnxEvent, x: number) => {
        for (const [lineId, line] of Object.entries(event.lyrics?.lines ?? {})) {
          const verse = lyricLineIds.indexOf(lineId);
          if (verse < 0) continue;
          const run = lyricRuns.get(lineId) ?? [];
          run.push({
            x,
            y: staffBottom + LYRIC_FIRST_BASELINE_DROP_SP + verse * LYRIC_LINE_SPACING_SP,
            text: line.text,
            continues: line.type === 'start' || line.type === 'middle'
          });
          lyricRuns.set(lineId, run);
        }
      };
      stdSequences.forEach((sequence, voiceIndex) => {
        sequence.content.forEach((item, eventIndex) => {
          const slot = m.voices[voiceIndex]?.[eventIndex];
          if (!slot) return;
          if (isGrace(item) || isTuplet(item)) {
            innerColumns(item, slot.x, plan.inkRatio, { useAccidentalDisplay, keyFifths: m.keyFifths })
              .forEach(({ event, x }) => addSyllables(event, x));
            return;
          }
          if (isTimedEvent(item)) addSyllables(item as MnxEvent, slot.x);
        });
      });
    }

    // Validation issues (user-fixable), the plan's issues (unsupported items),
    // plus anything an individual event throws (forgiving render) — one bad
    // event must not take down the bar. Issues attributable to one event draw
    // UNDER that event's column; the rest stack in the bar corner.
    const fromValidation = validationByMeasure.get(writtenIndex(plan, i)) ?? [];
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
        measureIndex: writtenIndex(plan, i),
        entryIndex: m.entry ? i : undefined,
        occurrenceOrdinal: m.entry?.ordinal,
        performedNoteKeys: m.entry ? performedKeys(mnx, m.entry) : undefined,
        activeNoteIds,
        selectedNoteIds,
        // This layout IS the staff-1-of-first-part traversal jsonView mirrors.
        synthesizeKeys: true,
        keyPartIndex: context ? mnx.parts.indexOf(part) : 0,
        keyStaffIndex: context?.staffIndex,
        primitives,
        index,
        onIssue: message => measureIssues.push({ kind: 'render', message }),
        positionContext,
        row: m.row,
        measureEndX: m.x + m.width,
        technique,
        // The standalone view has no notation staff to carry them.
        showTupletBrackets: true,
        // The plan priced this measure's tuplet columns with these; the walk
        // over them has to agree term for term.
        accidentalContext: { useAccidentalDisplay, keyFifths: m.keyFifths }
      });
    }

    // Dynamics and directions under/over the tab staff — the part's, at
    // their columns, exactly as the notation staff draws them. BEFORE the
    // score text below, which scans the row's ink to clear it.
    if (stdSequences.length > 0) {
      const positionedArgs = {
        partMeasure,
        m: { x: m.x, width: m.width, staves: [m.voices] },
        sequencesByStaff: [stdSequences],
        staffBottoms: [staffBottom],
        primitives
      };
      emitDynamics(positionedArgs);
      emitDirections({ ...positionedArgs, staffTops: [staffTop] });
    }

    // Score-wide marks from the GLOBAL measure — the tempo, the navigation
    // marks and the structural labels. They describe the BAR, not a notation
    // staff (MNX gives them a `location`, never a `staff`), so a tab reader is
    // owed them exactly as much: a section name and a D.S. are how you know
    // where you are in the piece, and losing them was losing the map.
    //
    // Same order as the notation layout, and the order matters: labels scan
    // what already sits over this measure and stack above it.
    const gm = mnx.global.measures[writtenIndex(plan, i)] ?? {};
    // The text clears THIS ROW's ink only; the row above is tightenRows' job.
    if (!context || context.globalLabels) {
    emitHarmonies({ gm, m, stdSequences, staffTop, scan: primitives.slice(rowStart[m.row]), primitives });
    const tempoTop = emitTempoMark({
      gm, m, staffTop, scan: primitives.slice(rowStart[m.row]), primitives,
      onsetXs: measureOnsetXs(stdSequences[0], m.voices[0] ?? [])
    });
    if (!m.entry) emitNavigationMarkers({ gm, m, stdSequences, staffTop, primitives });
    emitMeasureFermata({ gm, m, staffTop, staffHeight: STAFF_HEIGHT_SP, primitives });
    emitOccurrenceLabel(m, staffTop, primitives);
    emitMeasureNumber(gm, m, staffTop, primitives, display.barNumbers, measureNumbers[writtenIndex(plan, i)]);
    emitScoreLabels({
      gm, m, staffTop, scan: primitives.slice(rowStart[m.row]), clearAbove: tempoTop, primitives
    });

    }

    // End barline — the global measure's style, defaulted per the spec. A tab
    // staff is owed it for the same reason it is owed a section name: the
    // barline describes the BAR, not a notation staff.
    const isLast = i === numMeasures - 1 || plan.measures.slice(i + 1).every(measure => measure.hidden);
    if (m.repeatEnd) {
      // Backward repeat :| — dots + thin + thick, and the "4x" over it.
      const barX = m.x + m.width;
      emitRepeatEndStrokes(barX, staffTop, staffBottom, REPEAT_METRICS, primitives);
      emitRepeatDots(barX, repeatEndDotDx(REPEAT_METRICS), staffTop, TAB_REPEAT_DOT_YS, primitives);
      emitRepeatTimes(m.repeatEnd.times, barX, staffTop, primitives);
    } else {
      emitEndBarline({
        type: resolveBarlineType(gm.barline, isLast),
        x: m.x + m.width,
        top: staffTop,
        bottom: staffBottom,
        metrics: BARLINE_METRICS,
        primitives
      });
    }


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
      for (const { at: _at, ...issue } of anchored) diagnostics.push({ measureIndex: writtenIndex(plan, i), ...issue });
    }
    if (measureIssues.length) {
      emitMeasureDiagnostics(m.x, staffBottom, measureIssues, primitives);
      for (const issue of measureIssues) diagnostics.push({ measureIndex: writtenIndex(plan, i), ...issue });
    }
    qualifyMeasure(mnx, m, primitives, measurePrimitiveStart, index, selectedNoteIds);
  }

  // Verse rows flush before the frame is fitted, for the same reason as the
  // technique marks below: they are ink, and the fit passes measure ink.
  emitLyricRuns(lyricRuns.values(), primitives);

  // Before the frame is fitted: the marks are ink like any other, and both
  // `ensureTopMargin` and `tightenRows` measure ink to decide how much room a
  // row actually needs. Emitted after, a bend arrow would hang off the page.
  if (hasTechniqueSites(technique)) {
    qualifyTechniques(technique, plan);
    emitTabTechnique({
      sites: technique.sites,
      byNoteId: technique.byNoteId,
      rowEdges,
      ink: plan.inkRatio,
      primitives
    });
  }

  const baseHeightSp = 2 * MARGIN_SP + Math.max(1, plan.rowCount) * rowHeightSp;
  const baseRows = Array.from({ length: Math.max(1, plan.rowCount) }, (_, r) => rowBand(r));

  // ROW_PAD_TOP_SP is sized for a capo line, and the score-wide labels stack
  // higher than that — a rehearsal box over a metronome mark reaches past the
  // page top and would be quietly clipped. Fit the frame to the ink FIRST, so
  // the density pass below sees a layout whose gaps are all real.
  const fitted = ensureTopMargin(primitives, baseRows, baseHeightSp, MARGIN_SP);
  const heightSp = fitted?.heightSp ?? baseHeightSp;
  const rows = fitted?.rows ?? baseRows;

  const fitRows = opts.densityPad === undefined && display.clearance !== 2
    ? fitRowsToClearance
    : tightenRows;
  const tightened = fitRows({
    primitives, rows, heightSp, padDensity: opts.densityPad, clearance: display.clearance,
    // The verse block belongs to the row it hangs from — without this the
    // midpoint attribution files a deep verse row with the system below.
    reservedBelowSp: lyricBlockSp
  });

  return {
    primitives, widthSp, heightSp: tightened?.heightSp ?? heightSp,
    usedWidthSp: plan.usedWidthSp, naturalWidthSp,
    index, diagnostics, rows: tightened?.rows ?? rows,
    packings: [plan.packing]
  };
}

/** Compose tab systems from the existing staff emitter, using ONE packing plan.
 * Each staff's ink is measured before stacking, so lyrics and technique marks
 * cannot be clipped by a fixed-height gutter. No document copies or rewritten IDs. */
function layoutTabSystems(opts: LayoutTabOptions): LayoutResult {
  const { mnx, widthSp } = opts;
  const display = normalizeDisplayOptions(opts.display, opts.hide);
  const primitives: Primitive[] = [];
  const index: SpatialIndex = new Map();
  const diagnostics: LayoutDiagnostic[] = [];
  const rows: RowBandSp[] = [];
  const displays: RowBandSp[][] = [];
  const packings: NonNullable<LayoutResult['packings']> = [];
  const clearance = clearanceSpacing(display.clearance, opts.densityPad);
  let cursorY = clearance.tabOuterMargin(MARGIN_SP);
  let usedWidthSp = 0;
  let naturalWidthSp: number | undefined;
  for (const job of buildScoreJobs(mnx)) {
    if (job.title !== null && display.title !== 'hide') {
      cursorY += 2.4;
      primitives.push({ kind: 'text', text: job.title, x: widthSp / 2, y: cursorY,
        font: 'body', size: 2.4, anchor: 'middle', className: 'score-title' });
      cursorY += 3;
    }
    (opts.entries ? job.segments.slice(0, 1) : job.segments).forEach((segment, segmentIndex) => {
      const sources = segment.staves.flatMap(staff => staff.sources).filter(source => tabPositionContext(source.part, opts.tabSetup) !== null).filter((source, i, all) =>
        all.findIndex(candidate => candidate.part === source.part && candidate.staff === source.staff) === i);
      if (!sources.length) return;
      const parts = [...new Set(sources.map(source => source.part))];
      const first = segmentIndex === 0;
      const names = display.instrumentNames === 'every-system' || (display.instrumentNames === 'first-system' && first);
      const planOptions: PlanOptions = {
        entries: opts.entries,
        staves: sources.map(source => ({ sources: [source] })),
        staffKind: 'tab', display, lyricLineIds: selectedLyricLineIds(mnx, display),
        spacingMode: opts.spacingMode,
    densityH: opts.densityH, densityPad: opts.densityPad, inkRatio: opts.inkRatio,
        forcedBreaks: segment.forcedBreaks, measureRange: segment.range ?? undefined,
        minMeasures: segment.minMeasures, collapse: job.collapse,
        leftInsetSp: names ? instrumentLabelInset(parts.map(part => instrumentName(part, first))) : 0,
        subsequentLeftInsetSp: display.instrumentNames === 'every-system' ? instrumentLabelInset(parts.map(part => instrumentName(part, false))) : 0
      };
      const plan = planHorizontal(mnx, widthSp, planOptions);
      const natural = clampDensity(opts.densityH) === 1 ? undefined : planHorizontal(mnx, widthSp, { ...planOptions, densityH: 1 }).usedWidthSp;
      packings.push(plan.packing);
      usedWidthSp = Math.max(usedWidthSp, plan.usedWidthSp);
      if (natural !== undefined) naturalWidthSp = Math.max(naturalWidthSp ?? 0, natural);
      const staffs = sources.map((source, staff) => {
        const result = layoutTabStaff(opts, {
          part: source.part, staffIndex: source.staff, globalLabels: staff === 0,
          firstScoreSegment: first, partLabel: sources.findIndex(candidate => candidate.part === source.part) === staff,
          naturalWidthSp: natural,
          plan: { ...plan, measures: plan.measures.map(measure => ({ ...measure, voices: measure.staves[staff] ?? [] })) }
        });
        for (const [key, location] of result.index) index.set(key, location);
        for (const diagnostic of result.diagnostics) {
          if (!diagnostics.some(existing => existing.measureIndex === diagnostic.measureIndex && existing.message === diagnostic.message)) diagnostics.push(diagnostic);
        }
        const bands = result.rows ?? [];
        const lyricCount = selectedLyricLineIds(mnx, display)?.length ?? documentLyricLineIds(mnx).length;
        const boundaries = rowBoundariesSp(bands, lyricBlockSpFor(lyricCount));
        const bins: Primitive[][] = bands.map(() => []);
        for (const primitive of result.primitives) {
          let row = 0;
          while (row < boundaries.length && anchorY(primitive) >= boundaries[row]) row++;
          bins[row].push(primitive);
        }
        return { bands, bins };
      });
      for (let row = 0; row < plan.rowCount; row++) {
        const system: RowBandSp[] = [];
        for (const staff of staffs) {
          const band = staff.bands[row];
          const ink = computeBoundsSp(staff.bins[row]);
          const top = Math.min(band.staffTop, ink?.y ?? band.staffTop);
          const bottom = Math.max(band.staffBottom, ink ? ink.y + ink.h : band.staffBottom);
          const dy = cursorY - top;
          for (const primitive of staff.bins[row]) {
            translatePrimitiveY(primitive, dy);
            primitives.push(primitive);
          }
          system.push({ staffTop: band.staffTop + dy, staffBottom: band.staffBottom + dy });
          cursorY += bottom - top + clearance.staffInk;
        }
        cursorY += clearance.systemInk - clearance.staffInk;
        displays.push(system);
        rows.push({ staffTop: system[0].staffTop, staffBottom: system[system.length - 1].staffBottom });
      }
    });
  }
  return { primitives, index, diagnostics, rows, displays, packings,
    widthSp, usedWidthSp, naturalWidthSp, heightSp: cursorY + (opts.densityPad !== undefined || display.clearance === 2 ? MARGIN_SP : clearance.tabOuterMargin(MARGIN_SP + 3) - clearance.systemInk) };
}
