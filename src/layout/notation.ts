import { MnxStructure, MnxEvent } from '../types/mnx.ts';
import { Primitive, LayoutResult, SpatialIndex } from '../primitives.ts';
import { glyphAnchor } from '../smufl/smufl.ts';

/**
 * Pure layout for standard 5-line notation. Working in staff spaces, returns
 * primitives for the renderer + a sourceId → location index.
 *
 * Scope:
 *   - 5-line staff with treble/bass clefs, 8vb octave marker
 *   - Time signatures (digits via SMuFL)
 *   - Notes: noteheads (whole/half/black), stems, flags, accidentals, dots, chords, ledger lines
 *   - Rests by duration
 *   - Barlines (regular, final, system-start), mid-system clef/time changes
 *   - Multi-voice with auto stem direction (v1 down, v2 up; single-voice by position)
 *
 * Out of scope (deferred): key signatures, beams, slurs, ties, dynamics, tuplets.
 */

// ---------- Layout constants (staff spaces) ----------

const STAFF_LINES = 5;
const STAFF_HEIGHT_SP = STAFF_LINES - 1; // 4 sp from top line to bottom line
const STAFF_MIDDLE_Y = STAFF_HEIGHT_SP / 2; // 2 sp from top

const ROW_PAD_TOP_SP = 6;    // extra room for ledger lines / stems above
const ROW_PAD_BOTTOM_SP = 6;
const ROW_HEIGHT_SP = STAFF_HEIGHT_SP + ROW_PAD_TOP_SP + ROW_PAD_BOTTOM_SP;
const MARGIN_SP = 2;

const STAFF_LINE_THICKNESS_SP = 0.13;
const LEDGER_LINE_THICKNESS_SP = 0.16;
const STEM_THICKNESS_SP = 0.12;
const BARLINE_THICKNESS_SP = 0.16;
const FINAL_BARLINE_THICK_SP = 0.5;
const FINAL_BARLINE_GAP_SP = 0.3;

const STEM_LENGTH_SP = 3.5;
const NOTEHEAD_WIDTH_SP = 1.18;
const LEDGER_OVERHANG_SP = 0.4; // ledger extends this much beyond notehead each side

const ACCIDENTAL_RIGHT_PAD_SP = 0.15;
const DOT_RIGHT_PAD_SP = 0.35;

const START_BARLINE_PAD_SP = 0.5;
const CLEF_WIDTH_SP = 3;
const TIME_SIG_WIDTH_SP = 2.5;
const CONTENT_LEFT_PAD_SP = 0.6;
const CONTENT_RIGHT_PAD_SP = 0.8;

const ACTIVE_COLOR = 'oklch(0.65 0.22 274)';
const SELECTED_COLOR = 'oklch(0.7 0.15 190)';

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

const NOTEHEAD_GLYPH_BY_BASE: Record<string, string> = {
  whole: 'noteheadWhole',
  half: 'noteheadHalf',
  quarter: 'noteheadBlack',
  eighth: 'noteheadBlack',
  sixteenth: 'noteheadBlack',
  'thirty-second': 'noteheadBlack'
};

// flags only on unbeamed durations shorter than quarter
const FLAG_GLYPH_BY_BASE_UP: Record<string, string | null> = {
  whole: null, half: null, quarter: null,
  eighth: 'flag8thUp',
  sixteenth: 'flag16thUp',
  'thirty-second': 'flag32ndUp'
};
const FLAG_GLYPH_BY_BASE_DOWN: Record<string, string | null> = {
  whole: null, half: null, quarter: null,
  eighth: 'flag8thDown',
  sixteenth: 'flag16thDown',
  'thirty-second': 'flag32ndDown'
};

const REST_GLYPH_BY_BASE: Record<string, string> = {
  whole: 'restWhole',
  half: 'restHalf',
  quarter: 'restQuarter',
  eighth: 'rest8th',
  sixteenth: 'rest16th',
  'thirty-second': 'rest32nd'
};

// Rest y-positions (alphabetic baseline = SMuFL origin) relative to staffTop
const REST_Y_BY_BASE: Record<string, number> = {
  whole: 1,       // hangs from line 2 from top (4th line from bottom)
  half: 2,        // sits on middle line
  quarter: 2,    // centred on middle line
  eighth: 2,
  sixteenth: 2,
  'thirty-second': 2
};

// ---------- Pitch → staff y ----------

const STEP_ORDER: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

function diatonicStepIndex(step: string, octave: number): number {
  return octave * 7 + (STEP_ORDER[step.toUpperCase()] ?? 0);
}

interface ActiveClef {
  sign: 'G' | 'F' | 'C';
  octave: number;   // MNX clef.octave: -1 = sounds 8vb, +1 = sounds 8va
}

/**
 * Map a sounding-pitch (step, octave) to a y-coord on the staff (sp from
 * staffTop). Lower y = higher pitch. Clef.octave compensates so the WRITTEN
 * position appears on the staff at the conventional place.
 */
function pitchToStaffY(step: string, octave: number, clef: ActiveClef): number {
  // MNX stores sounding pitch. Treble 8vb (clef.octave=-1) shifts written +1.
  const writtenOctave = octave - clef.octave;
  const noteIndex = diatonicStepIndex(step, writtenOctave);
  if (clef.sign === 'F') {
    const refIndex = diatonicStepIndex('F', 3); // F3 sits on the 4th line from bottom = y=1
    return 1 - (noteIndex - refIndex) * 0.5;
  }
  // Default: treble. G4 sits on the 2nd line from bottom = y=3
  const refIndex = diatonicStepIndex('G', 4);
  return 3 - (noteIndex - refIndex) * 0.5;
}

function clefGlyph(clef: ActiveClef): string {
  if (clef.sign === 'F') return 'fClef';
  if (clef.octave === -1) return 'gClef8vb';
  if (clef.octave === 1) return 'gClef8va';
  return 'gClef';
}

function clefY(clef: ActiveClef, staffTop: number): number {
  // SMuFL clef glyph origin = the staff line the clef pinches around.
  // Treble (and 8vb/8va variants): G4 line = y=3 from staffTop.
  // Bass: F3 line = y=1.
  if (clef.sign === 'F') return staffTop + 1;
  return staffTop + 3;
}

// ---------- Stem direction ----------

function autoStemDir(staffYs: number[]): 1 | -1 {
  // 1 = up, -1 = down. Convention: notes BELOW middle line stem up, AT or
  // ABOVE middle stem down. For chords, use the extreme furthest from middle.
  let maxDistance = 0;
  let dir: 1 | -1 = -1; // default: down (when distance ties at 0, we choose down)
  for (const y of staffYs) {
    const distance = Math.abs(y - STAFF_MIDDLE_Y);
    if (distance > maxDistance) {
      maxDistance = distance;
      dir = y > STAFF_MIDDLE_Y ? 1 : -1; // below middle → up; above middle → down
    }
  }
  return dir;
}

// ---------- Ledger lines ----------

function ledgerLinesForNote(staffY: number): number[] {
  const out: number[] = [];
  if (staffY < 0) {
    const top = Math.ceil(staffY);
    for (let l = -1; l >= top; l--) out.push(l);
  } else if (staffY > STAFF_HEIGHT_SP) {
    const bottom = Math.floor(staffY);
    for (let l = STAFF_HEIGHT_SP + 1; l <= bottom; l++) out.push(l);
  }
  return out;
}

function unionLedgerLines(staffYs: number[]): Set<number> {
  const set = new Set<number>();
  for (const y of staffYs) for (const l of ledgerLinesForNote(y)) set.add(l);
  return set;
}

// ---------- Accidental glyph ----------

function accidentalGlyph(alter: number | undefined): string | null {
  if (alter === undefined || alter === 0) return null;
  if (alter === 1) return 'accidentalSharp';
  if (alter === -1) return 'accidentalFlat';
  if (alter === 2) return 'accidentalDoubleSharp';
  if (alter === -2) return 'accidentalDoubleFlat';
  return null;
}

// ---------- Public API ----------

export interface LayoutNotationOptions {
  mnx: MnxStructure;
  widthSp: number;
  activeNoteIds?: readonly string[];
  selectedNoteIds?: readonly string[];
}

export function layoutNotation(opts: LayoutNotationOptions): LayoutResult {
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
  // part.name is optional in the MNX schema (the corpus's minimal-single-note
  // scenario pins this) — guard before sniffing for the guitar default.
  const isGuitarPart = (part.name ?? '').toLowerCase().includes('guitar');

  // Initial active state. Guitar parts default to treble 8vb.
  let activeClef: ActiveClef = { sign: 'G', octave: isGuitarPart ? -1 : 0 };
  let activeTimeSig = { count: 4, unit: 4 };

  for (let i = 0; i < numMeasures; i++) {
    const globalMeasure = mnx.global.measures[i] ?? {};
    const partMeasure = part.measures[i] ?? { sequences: [] };

    // Detect changes — show indicator if changed mid-system
    let clefChanged = false;
    let timeSigChanged = false;
    if (partMeasure.clefs) {
      const staff1Clef = partMeasure.clefs.find((c: any) => !c.staff || c.staff === 1);
      if (staff1Clef && staff1Clef.clef) {
        const sign = (staff1Clef.clef.sign ?? 'G').toUpperCase() as 'G' | 'F' | 'C';
        // If MNX omits octave, preserve the current octave when sign matches
        // (so the guitar 8vb default isn't lost to a declaration of plain G).
        const oct = staff1Clef.clef.octave ?? (sign === activeClef.sign ? activeClef.octave : 0);
        if (sign !== activeClef.sign || oct !== activeClef.octave) {
          activeClef = { sign, octave: oct };
          if (i > 0) clefChanged = true;
        }
      }
    }
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
    const showClef = isFirstInSystem || clefChanged;
    const showTimeSig = i === 0 || timeSigChanged;

    const startBarlinePad = showStartBarline ? START_BARLINE_PAD_SP : 0;
    const clefSpace = showClef ? CLEF_WIDTH_SP : 0;
    const timeSigSpace = showTimeSig ? TIME_SIG_WIDTH_SP : 0;
    const contentStartX =
      x + CONTENT_LEFT_PAD_SP + startBarlinePad + clefSpace + timeSigSpace;
    const contentWidth =
      x + measureAllocatedWidth - CONTENT_RIGHT_PAD_SP - contentStartX;

    // Staff lines
    for (let s = 0; s < STAFF_LINES; s++) {
      const lineY = staffTop + s;
      primitives.push({
        kind: 'line',
        x1: x, y1: lineY, x2: x + measureAllocatedWidth, y2: lineY,
        thickness: STAFF_LINE_THICKNESS_SP,
        className: 'staff-line'
      });
    }

    if (showStartBarline) {
      primitives.push({
        kind: 'line',
        x1: x, y1: staffTop, x2: x, y2: staffBottom,
        thickness: BARLINE_THICKNESS_SP,
        className: 'barline barline-start'
      });
    }

    if (showClef) {
      primitives.push({
        kind: 'glyph',
        glyph: clefGlyph(activeClef),
        x: x + CONTENT_LEFT_PAD_SP + startBarlinePad,
        y: clefY(activeClef, staffTop),
        className: 'clef'
      });
    }

    if (showTimeSig) {
      const tsX = x + CONTENT_LEFT_PAD_SP + startBarlinePad + clefSpace + TIME_SIG_WIDTH_SP / 2;
      const numY = staffTop + 1; // visual centre of upper half (line 2 from top)
      const denY = staffTop + 3; // visual centre of lower half
      for (const digit of String(activeTimeSig.count)) {
        primitives.push({
          kind: 'glyph', glyph: 'timeSig' + digit,
          x: tsX, y: numY, anchor: 'middle',
          className: 'time-sig-num'
        });
      }
      for (const digit of String(activeTimeSig.unit)) {
        primitives.push({
          kind: 'glyph', glyph: 'timeSig' + digit,
          x: tsX, y: denY, anchor: 'middle',
          className: 'time-sig-den'
        });
      }
    }

    // Events per voice (staff 1 only)
    const stdSequences = (partMeasure.sequences ?? []).filter(
      seq => seq.staff === 1 || seq.staff === undefined
    );
    const measureDuration = activeTimeSig.count / activeTimeSig.unit;
    const voiceStemOverride: (1 | -1 | null)[] =
      stdSequences.length > 1
        ? stdSequences.map((_, idx) => (idx === 0 ? -1 : 1))
        : stdSequences.map(() => null);

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
        `[notation] measure ${i}: voice durations exceed time signature ` +
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

        emitEvent({
          event,
          eventX,
          staffTop,
          clef: activeClef,
          stemOverride: voiceStemOverride[voiceIndex],
          activeNoteIds,
          selectedNoteIds,
          primitives,
          index,
          measureIndex: i,
          voiceIndex,
          eventIndex
        });

        cumDuration += eventDur;
      });
    });

    // End barline
    const isLast = i === numMeasures - 1;
    const barX = x + measureAllocatedWidth;
    if (isLast) {
      const thinX = barX - FINAL_BARLINE_THICK_SP - FINAL_BARLINE_GAP_SP;
      primitives.push({
        kind: 'line',
        x1: thinX, y1: staffTop, x2: thinX, y2: staffBottom,
        thickness: BARLINE_THICKNESS_SP,
        className: 'barline barline-final-thin'
      });
      primitives.push({
        kind: 'rect',
        x: barX - FINAL_BARLINE_THICK_SP, y: staffTop,
        w: FINAL_BARLINE_THICK_SP, h: STAFF_HEIGHT_SP,
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

// ---------- Event emission ----------

interface EmitEventArgs {
  event: MnxEvent;
  eventX: number;
  staffTop: number;
  clef: ActiveClef;
  stemOverride: 1 | -1 | null;
  activeNoteIds: readonly string[];
  selectedNoteIds: readonly string[];
  primitives: Primitive[];
  index: SpatialIndex;
  measureIndex: number;
  voiceIndex: number;
  eventIndex: number;
}

function emitEvent(args: EmitEventArgs): void {
  const {
    event, eventX, staffTop, clef, stemOverride,
    activeNoteIds, selectedNoteIds,
    primitives, index, measureIndex, voiceIndex, eventIndex
  } = args;

  const base = event.duration.base;
  const dots = event.duration.dots ?? 0;

  // ---- Rest ----
  if (event.rest) {
    const glyph = REST_GLYPH_BY_BASE[base] ?? 'restQuarter';
    const yOffset = REST_Y_BY_BASE[base] ?? 2;
    primitives.push({
      kind: 'glyph',
      glyph,
      x: eventX,
      y: staffTop + yOffset,
      anchor: 'middle',
      className: 'rest'
    });
    // Augmentation dots for rests
    for (let d = 0; d < dots; d++) {
      primitives.push({
        kind: 'glyph',
        glyph: 'augmentationDot',
        x: eventX + 0.7 + d * 0.3,
        y: staffTop + (base === 'whole' ? 1 : 1.5),
        className: 'dot'
      });
    }
    return;
  }

  // ---- Notes ----
  if (!event.notes || event.notes.length === 0) return;

  const notes = event.notes;
  const noteheadGlyph = NOTEHEAD_GLYPH_BY_BASE[base] ?? 'noteheadBlack';
  const noteIds = notes.map(n => n.id).filter((id): id is string => !!id);
  const primaryNoteId = noteIds[0];

  // Pitch → staff y for each chord member
  const staffYs = notes.map(n => pitchToStaffY(n.pitch.step, n.pitch.octave, clef));

  // Highlight color (whole event highlights if any member is active/selected)
  const isActive = noteIds.some(id => activeNoteIds.includes(id));
  const isSelected = noteIds.some(id => selectedNoteIds.includes(id));
  const fill = isActive ? ACTIVE_COLOR : isSelected ? SELECTED_COLOR : undefined;
  const colorClass = isActive ? ' active' : isSelected ? ' selected' : '';

  // Stem direction
  const eventStemDir = (event as { stemDirection?: 'up' | 'down' }).stemDirection;
  const stemDir: 1 | -1 = stemOverride !== null
    ? stemOverride
    : eventStemDir === 'up' ? 1
    : eventStemDir === 'down' ? -1
    : autoStemDir(staffYs);
  const hasStem = noteheadGlyph !== 'noteheadWhole';

  // Ledger lines
  const ledgerYs = unionLedgerLines(staffYs);
  for (const ly of ledgerYs) {
    primitives.push({
      kind: 'line',
      x1: eventX - NOTEHEAD_WIDTH_SP / 2 - LEDGER_OVERHANG_SP,
      y1: staffTop + ly,
      x2: eventX + NOTEHEAD_WIDTH_SP / 2 + LEDGER_OVERHANG_SP,
      y2: staffTop + ly,
      thickness: LEDGER_LINE_THICKNESS_SP,
      stroke: fill,
      className: 'ledger-line'
    });
  }

  // Accidentals (left of the notehead column)
  const accidentalEntries = notes
    .map((n, idx) => ({
      glyph: accidentalGlyph(n.pitch.alter),
      staffY: staffYs[idx]
    }))
    .filter(e => e.glyph);
  const accidentalsToLeft = accidentalEntries.length;
  const accidentalSlotWidth = 1.0; // sp per accidental column (simple stacking)
  accidentalEntries.forEach((acc, idx) => {
    const offset = (accidentalsToLeft - idx) * accidentalSlotWidth + ACCIDENTAL_RIGHT_PAD_SP;
    primitives.push({
      kind: 'glyph',
      glyph: acc.glyph!,
      x: eventX - NOTEHEAD_WIDTH_SP / 2 - offset,
      y: staffTop + acc.staffY,
      fill,
      className: 'accidental' + colorClass
    });
  });

  // Noteheads
  notes.forEach((n, idx) => {
    const y = staffTop + staffYs[idx];
    primitives.push({
      kind: 'glyph',
      glyph: noteheadGlyph,
      x: eventX - NOTEHEAD_WIDTH_SP / 2,
      y,
      fill,
      className: 'notehead' + colorClass,
      sourceId: n.id ?? primaryNoteId
    });
  });

  // Stem
  let stemTopY: number | undefined;
  let stemBottomY: number | undefined;
  let stemX: number | undefined;
  if (hasStem) {
    const minStaffY = Math.min(...staffYs);
    const maxStaffY = Math.max(...staffYs);
    if (stemDir === 1) {
      // up: from right of lowest notehead (highest y in our coords) upward
      const anchor = glyphAnchor(noteheadGlyph, 'stemUpSE') ?? { x: NOTEHEAD_WIDTH_SP, y: 0.168 };
      stemX = eventX - NOTEHEAD_WIDTH_SP / 2 + anchor.x;
      stemBottomY = staffTop + maxStaffY + anchor.y;
      stemTopY = staffTop + minStaffY - STEM_LENGTH_SP;
    } else {
      // down: from left of highest notehead downward
      const anchor = glyphAnchor(noteheadGlyph, 'stemDownNW') ?? { x: 0, y: -0.168 };
      stemX = eventX - NOTEHEAD_WIDTH_SP / 2 + anchor.x;
      stemTopY = staffTop + minStaffY + anchor.y;
      stemBottomY = staffTop + maxStaffY + STEM_LENGTH_SP;
    }
    primitives.push({
      kind: 'line',
      x1: stemX, y1: stemTopY,
      x2: stemX, y2: stemBottomY,
      thickness: STEM_THICKNESS_SP,
      stroke: fill,
      className: 'stem' + colorClass
    });

    // Flag (only on unbeamed flagged durations)
    const flagGlyph = stemDir === 1
      ? FLAG_GLYPH_BY_BASE_UP[base]
      : FLAG_GLYPH_BY_BASE_DOWN[base];
    if (flagGlyph) {
      const flagY = stemDir === 1 ? stemTopY : stemBottomY;
      primitives.push({
        kind: 'glyph',
        glyph: flagGlyph,
        x: stemX,
        y: flagY,
        fill,
        className: 'flag' + colorClass
      });
    }
  }

  // Augmentation dots (one per dot, in the space adjacent to each notehead)
  if (dots > 0) {
    notes.forEach((_n, idx) => {
      const y = staffYs[idx];
      // place dot in adjacent space (not on a line)
      const isOnLine = Math.round(y) === y;
      const dotY = isOnLine ? y - 0.5 : y;
      for (let d = 0; d < dots; d++) {
        primitives.push({
          kind: 'glyph',
          glyph: 'augmentationDot',
          x: eventX + NOTEHEAD_WIDTH_SP / 2 + DOT_RIGHT_PAD_SP + d * 0.4,
          y: staffTop + dotY,
          fill,
          className: 'dot'
        });
      }
    });
  }

  // Index
  if (primaryNoteId) {
    index.set(primaryNoteId, { measureIndex, voiceIndex, eventIndex });
    for (const id of noteIds) {
      if (!index.has(id)) index.set(id, { measureIndex, voiceIndex, eventIndex });
    }
  }
}
