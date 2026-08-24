import type { MnxNote, MnxTabTechnique } from '../../model/mnx.ts';
import type { Primitive, Point } from '../primitives.ts';

/**
 * PLAYING TECHNIQUE — the drawing half of
 * roadmap/complete/core-guitar-technique.md.
 *
 * Bends, slides, hammer-ons, pull-offs, vibrato, palm mute and harmonics have
 * travelled through both converters and the schema since 2026-07-26 and
 * nothing drew any of them: a document could carry 42 harmonics and still
 * render as an instruction to pick every note. This module is where they
 * become ink.
 *
 * **One module, two staves.** `_x.mnxLab.tab.technique` is drafted for
 * standard MNX rather than for tab (the block says so itself in
 * spec/mnx-lab-extensions.schema.json): none of these techniques requires a
 * position and none is specific to a fretted instrument, so a document that
 * declares no strings still has something to say and a notation staff still
 * has to say it. The two staves engrave the same data differently — a bend
 * hangs off a fret digit, a slur hugs a notehead — so `emitTabTechnique` and
 * `emitNotationTechnique` are separate emitters over one shared vocabulary of
 * sites, labels and curve splitting, rather than one emitter with a staff flag
 * threaded through every measurement.
 *
 * **Everything runs as a POST-PASS**, for the reason slurs and ties do: three
 * of these techniques (`hammerOn`, `pullOff`, `slide`) name their destination
 * by NOTE ID, and that note may sit in a later measure or on a later system
 * row. So each layout records a `TechniqueSite` per drawn note while it emits,
 * when it still knows where the ink went, and the marks are drawn once the
 * whole segment's geometry is known.
 *
 * **Ink discipline** (see `PrimitiveBase`): every HORIZONTAL distance from a
 * column is an ink offset and goes in `dx`, or is priced by `ink` where the
 * primitive has no `dx` field (curves). Vertical distances are already on the
 * vertical scale and are never multiplied by `ink` — doing so would stretch
 * every mark's height by the staff's aspect ratio.
 */

// ---------- Reading the model ----------

/** The technique block a note carries, if any. */
export function techniqueOf(note: MnxNote): MnxTabTechnique | undefined {
  return note._x?.mnxLab?.tab?.technique;
}

/** Does this note carry any technique at all? (Cheap gate for the walks.) */
export function hasTechnique(note: MnxNote): boolean {
  const t = techniqueOf(note);
  return t !== undefined && Object.keys(t).length > 0;
}

// ---------- Sites: what a layout records as it emits ----------

/**
 * One drawn note, as the technique post-pass needs to see it. A layout fills
 * these in while it emits digits or noteheads; by the time the post-pass runs,
 * the primitive list has forgotten which note was which.
 */
export interface TechniqueSite {
  /** The event's column centre — a musical POSITION (see `PrimitiveBase`). */
  x: number;
  /**
   * Where this event's own duration ends: the next column in the same voice,
   * or the bar's end barline. A mark that lasts as long as the note — a
   * vibrato wiggle, a bend curve, a palm-mute run — draws across this.
   */
  endX: number;
  /** The mark's home: the string line (tab) or the notehead centre (notation). */
  y: number;
  /**
   * Where free-standing marks bottom out — just clear of the staff, or of the
   * event's own ink where that reaches higher. Marks stack UPWARD from here,
   * so y decreases.
   */
  laneY: number;
  /** System row. A mark whose ends straddle two rows splits at the break. */
  row: number;
  /** Half the drawn width of the digit or notehead the mark hangs off, in INK
   *  staff spaces — what a mark has to clear before it starts. */
  halfWidthSp: number;
  /** Which voice this event belongs to; palm-mute runs are per voice. */
  voiceKey: string;
  /**
   * The event's index within its voice, counted across measures and counting
   * RESTS. Palm mute is a per-note flag that reads as a span, so its run is
   * "consecutive events" — and a rest has to break one, which is exactly what
   * counting an ordinal the rest also consumes buys.
   */
  ordinal: number;
  /** The note's own id, when it has one. */
  noteId?: string;
  /** The drawn fret, on a tab staff. Two digits on ONE string sit at the same
   *  y, so this is the only thing that says which way a slide between them
   *  travels. Absent on a notation staff, where the pitches say it. */
  fret?: number;
  /** Stem direction, on a notation staff. A technique slur takes the side
   *  away from the stem, exactly as an ordinary slur does — drawn on the stem
   *  side it would be crossed by every stem it spans. */
  stemDir?: 1 | -1;
  technique?: MnxTabTechnique;
}

export interface TechniqueInput {
  /** In emission order. Within one `voiceKey` that order is chronological. */
  sites: readonly TechniqueSite[];
  /** Real note ids only — a technique target is an id REFERENCE, and a
   *  synthesized positional key is not one. */
  byNoteId: ReadonlyMap<string, TechniqueSite>;
  /** Per system row, the span a mark may be drawn across. */
  rowEdges: ReadonlyMap<number, { left: number; right: number }>;
  /** The plan's ink ratio (core-ink-priced-columns.md). */
  ink: number;
  primitives: Primitive[];
}

// ---------- Shared metrics (staff spaces) ----------

/** Slide lines, bend curves, the palm-mute dash. */
const STROKE_SP = 0.12;
/** Hammer/pull slurs — a shade heavier, and tapered like a real slur. */
const SLUR_SP = 0.16;
/** Air between a mark and the digit or notehead it leaves. */
const CLEAR_SP = 0.25;
/** "H", "P", "P.M.", "full" — one size for every technique label. */
const LABEL_SP = 0.9;
/** Ink height of `arrowheadBlackUp`/`Down` (Bravura), tail to tip. */
const ARROWHEAD_SP = 1.196;
/** Advance of one `guitarVibratoStroke`. */
const VIBRATO_ADVANCE_SP = 0.608;
/** Ink height of `stringsHarmonic`. */
const HARMONIC_CIRCLE_SP = 0.8;
/** How far a bend's peak rises above the lane. */
const BEND_RISE_SP = 1.8;
/** Minimum drawn length of a bend, however short the note's column. */
const BEND_MIN_SPAN_SP = 0.9;
/**
 * Longest a bend is drawn, and how much of the next column it leaves alone.
 *
 * A bend lasts the note's duration, but DRAWING it that way puts a half
 * note's arrow head-to-head with whatever the next note carries — two
 * "full" labels butted together in the corpus's own bend scenario. Printed
 * editions keep the arrow compact and let the label carry the size, so the
 * span is the note's duration clamped into a range: enough to show a curve
 * that rises, holds and releases, never enough to reach the next column.
 */
const BEND_MAX_SPAN_SP = 4;
const BEND_END_CLEAR_SP = 1.2;
/** A slide or bend stub, where the far end is off this system row. */
const STUB_SP = 0.9;
/** Baseline drop of a label under the mark it names. */
const LABEL_GAP_SP = 0.25;
/** How far a hammer/pull slur bulges away from its endpoints. */
const SLUR_BULGE_SP = 0.8;
/** Clearance between a notehead and a technique slur's endpoint — the same
 *  distance `notation.ts` keeps for an ordinary slur. */
const SLUR_END_PAD_SP = 0.8;
/** Vertical reach of a slide-in / slide-out stub. */
const SLIDE_STUB_RISE_SP = 0.7;
/**
 * Half the slant given to a slide whose two ends sit at the same height.
 *
 * On a tab staff that is the COMMON case — a slide along one string — and a
 * line drawn flat between the two digits would land exactly on the string
 * line already there and disappear. Printed tab slants it, and the slant is
 * the direction of travel, so the mark says which way the hand goes.
 */
const SLIDE_SLANT_SP = 0.3;
/** Baseline of a label sitting directly in the lane. */
const LANE_LABEL_DROP_SP = LABEL_SP * 1.15;

// ---------- Labels ----------

/**
 * A bend's printed size, in the units a player reads: STEPS, not semitones.
 * "full" is one whole step and everything else is quarters of one — the
 * vocabulary of every printed tab edition ("1/2", "1 1/2"), written with ASCII
 * slashes rather than the ¼ ½ ¾ codepoints so it renders in whatever body face
 * a host has loaded.
 *
 * Returns '' for a bend of nothing, which is how a caller knows not to draw a
 * label at all.
 */
export function bendLabel(semitones: number): string {
  const quarters = Math.round((semitones / 2) * 4);
  if (quarters <= 0) return '';
  if (quarters === 4) return 'full';
  const whole = Math.floor(quarters / 4);
  const rem = quarters % 4;
  const parts: string[] = [];
  if (whole > 0) parts.push(String(whole));
  if (rem > 0) parts.push(['', '1/4', '1/2', '3/4'][rem]);
  return parts.join(' ');
}

/**
 * The fret digit as a harmonic reads it: `<12>`.
 *
 * Angle brackets around the number are how tab editors mark a harmonic, and
 * putting them IN the digit rather than beside it keeps one text primitive
 * behind one knock-out mask — the invariant non-square-scale.test.ts pins as
 * "a mask stays over the thing it masks".
 */
export function harmonicFretText(fret: string): string {
  return `<${fret}>`;
}

/** The short label a non-natural harmonic prints; a natural one says it with
 *  the brackets alone and needs no word. */
export function harmonicLabel(type: string): string {
  switch (type) {
    case 'artificial': return 'A.H.';
    case 'pinch': return 'P.H.';
    case 'tap': return 'T.H.';
    case 'semi': return 'S.H.';
    case 'feedback': return 'Fdbk.';
    default: return '';
  }
}

// ---------- Shared drawing helpers ----------

/** A cubic through two points that leaves `from` flat and arrives at `to`
 *  steeply — the shape a bent string actually makes. */
function bendSegment(from: Point, to: Point): [Point, Point, Point, Point] {
  const dx = to.x - from.x;
  return [
    from,
    { x: from.x + dx * 0.55, y: from.y },
    { x: to.x - dx * 0.15, y: to.y },
    to
  ];
}

/**
 * An up- or down-pointing arrowhead whose TIP lands exactly on (x + dx, y).
 * Bravura draws both from a south-west origin, so an up arrow's tip is a full
 * ink height above its baseline and a down arrow's tip is on it.
 */
function arrowhead(
  dir: 'up' | 'down',
  x: number,
  dx: number,
  y: number,
  primitives: Primitive[]
): void {
  primitives.push({
    kind: 'glyph',
    glyph: dir === 'up' ? 'arrowheadBlackUp' : 'arrowheadBlackDown',
    x,
    ...(dx === 0 ? {} : { dx }),
    y: dir === 'up' ? y + ARROWHEAD_SP : y,
    anchor: 'middle',
    className: 'technique-bend-arrow'
  });
}

/**
 * A run of `guitarVibratoStroke` glyphs starting `startDx` right of `x` and
 * filling `spanSp` of drawn width. The strokes are ink, so the run is placed
 * and stepped in ink and only its LENGTH is measured against the column.
 */
function wiggle(
  x: number,
  startDx: number,
  spanSp: number,
  y: number,
  ink: number,
  primitives: Primitive[]
): void {
  const count = Math.max(1, Math.floor(spanSp / (VIBRATO_ADVANCE_SP * ink)));
  for (let i = 0; i < count; i++) {
    primitives.push({
      kind: 'glyph',
      glyph: 'guitarVibratoStroke',
      x,
      dx: startDx + i * VIBRATO_ADVANCE_SP,
      y,
      className: 'technique-vibrato'
    });
  }
}

/**
 * One curve, or two halves when its ends sit on different system rows: the
 * first runs out to the end of the start row, the second resumes at the target
 * row's left edge. The split `emitSlursAndTies` makes, for the same reason — a
 * curve drawn straight between the two would cross the whole page.
 */
function drawSplit(
  input: TechniqueInput,
  from: { x: number; y: number; row: number },
  to: { x: number; y: number; row: number },
  emit: (x0: number, y0: number, x1: number, y1: number) => void
): void {
  if (from.row === to.row) {
    emit(from.x, from.y, to.x, to.y);
    return;
  }
  const right = input.rowEdges.get(from.row)?.right ?? from.x + STUB_SP;
  const left = input.rowEdges.get(to.row)?.left ?? to.x - STUB_SP;
  emit(from.x, from.y, Math.max(right - 0.4, from.x + STUB_SP), from.y);
  emit(Math.min(left + 0.2, to.x - STUB_SP), to.y, to.x, to.y);
}

/** A tapered slur between two points; `dir` is -1 to bulge up, 1 to bulge
 *  down (y grows downward), the same convention `emitSlursAndTies` uses. */
function slur(
  x0: number, y0: number, x1: number, y1: number,
  dir: 1 | -1,
  className: string,
  primitives: Primitive[]
): void {
  const span = Math.max(x1 - x0, 0.8);
  primitives.push({
    kind: 'curve',
    points: [
      { x: x0, y: y0 },
      { x: x0 + span * 0.3, y: y0 + dir * SLUR_BULGE_SP },
      { x: x1 - span * 0.3, y: y1 + dir * SLUR_BULGE_SP },
      { x: x1, y: y1 }
    ],
    thickness: SLUR_SP,
    taper: true,
    className
  });
}

/** Which side a technique slur takes on a notation staff: away from the stem,
 *  defaulting to above where no stem direction is known. */
function slurSide(site: TechniqueSite): 1 | -1 {
  return site.stemDir === 1 ? 1 : -1;
}

/** A one-line technique label, centred over a column. */
function laneLabel(
  text: string,
  x: number,
  y: number,
  className: string,
  primitives: Primitive[]
): void {
  if (!text) return;
  primitives.push({
    kind: 'text',
    text,
    x,
    y,
    font: 'body',
    size: LABEL_SP,
    anchor: 'middle',
    baseline: 'alphabetic',
    className
  });
}

// ---------- Palm mute ----------

/**
 * Palm-mute runs, per voice: the maximal stretches of CONSECUTIVE events whose
 * notes carry the flag.
 *
 * `palmMute` is stored per note because that is how Guitar Pro stores it, but
 * it reads as a span — "P.M." over a dashed line — and drawing it per note
 * would print the abbreviation once per chug. The gap between what the model
 * says and what the page shows is an open question in docs/mnx-extensions.md;
 * this is the reading side of it.
 */
function palmMuteRuns(
  sites: readonly TechniqueSite[]
): { first: TechniqueSite; last: TechniqueSite; length: number }[] {
  const byVoice = new Map<string, Map<number, TechniqueSite>>();
  for (const s of sites) {
    if (!s.technique?.palmMute) continue;
    const inVoice = byVoice.get(s.voiceKey) ?? new Map<number, TechniqueSite>();
    // A chord's members share one ordinal — one run, not one per string.
    if (!inVoice.has(s.ordinal)) inVoice.set(s.ordinal, s);
    byVoice.set(s.voiceKey, inVoice);
  }
  const runs: { first: TechniqueSite; last: TechniqueSite; length: number }[] = [];
  for (const inVoice of byVoice.values()) {
    const ordinals = [...inVoice.keys()].sort((a, b) => a - b);
    let start = 0;
    for (let i = 0; i < ordinals.length; i++) {
      const next = ordinals[i + 1];
      const continues =
        next === ordinals[i] + 1 &&
        // A run cannot straddle a system break — the dash would leave the page.
        inVoice.get(next)!.row === inVoice.get(ordinals[i])!.row;
      if (continues) continue;
      runs.push({
        first: inVoice.get(ordinals[start])!,
        last: inVoice.get(ordinals[i])!,
        length: i - start + 1
      });
      start = i + 1;
    }
  }
  return runs;
}

/** "P.M." over a dashed line to the end of the run. */
function emitPalmMute(
  input: TechniqueInput,
  runs: { first: TechniqueSite; last: TechniqueSite; length: number }[]
): void {
  for (const { first, last, length } of runs) {
    const y = first.laneY - LANE_LABEL_DROP_SP;
    const text = 'P.M.';
    input.primitives.push({
      kind: 'text',
      text,
      x: first.x,
      dx: -first.halfWidthSp,
      y,
      font: 'body',
      size: LABEL_SP,
      anchor: 'start',
      baseline: 'alphabetic',
      className: 'technique-palm-mute'
    });
    // A run of ONE is the abbreviation alone: the dash says "keep muting as
    // far as here", and over a single note the label has already said it. A
    // stub the width of one column reads as a printing accident.
    if (length < 2) continue;
    const dashDx = -first.halfWidthSp + LABEL_SP * 0.6 * text.length + CLEAR_SP;
    const from = first.x + dashDx * input.ink;
    const to = last.endX - CLEAR_SP * input.ink;
    if (to <= from) continue;
    input.primitives.push({
      kind: 'line',
      x1: first.x, dx1: dashDx,
      y1: y - LABEL_SP * 0.3,
      x2: last.endX, dx2: -CLEAR_SP,
      y2: y - LABEL_SP * 0.3,
      thickness: STROKE_SP,
      dash: 0.25,
      className: 'technique-palm-mute-line'
    });
  }
}

// ---------- Bends ----------

/**
 * A bend, as a curve.
 *
 * `points` is an ordered list of `{position, alter}` — position a fraction of
 * the note's own duration, alter an offset in semitones — so the shape is
 * DRAWN rather than inferred from a single interval, which is the deficiency
 * the extension opens with (MusicXML's one `<bend-alter>` cannot state a bend
 * that rises, holds and releases).
 *
 * `alter` maps onto a FIXED rise normalised to the bend's own peak, which is
 * what a printed edition does: the label carries the size, the arrow carries
 * the gesture. `position` maps across the note's own column.
 *
 * A first point with a non-zero alter is a PRE-BEND — the string is already
 * bent when it sounds — and prints as the vertical arrow it is, with no rising
 * curve before it, because there is nothing to see happen.
 */
function emitBend(
  input: TechniqueInput,
  site: TechniqueSite,
  baseY: number,
  bend: { points: { position: number; alter: number }[] }
): void {
  const points = [...bend.points].sort((a, b) => a.position - b.position);
  if (points.length === 0) return;
  const peak = Math.max(...points.map(p => p.alter));
  if (peak <= 0) return;

  const { ink, primitives } = input;
  const topY = site.laneY - BEND_RISE_SP;
  const startX = site.x + (site.halfWidthSp + CLEAR_SP) * ink;
  const endX = Math.max(
    Math.min(site.endX - BEND_END_CLEAR_SP * ink, startX + BEND_MAX_SPAN_SP * ink),
    startX + BEND_MIN_SPAN_SP * ink
  );
  const xOf = (position: number) =>
    startX + Math.min(1, Math.max(0, position)) * (endX - startX);
  const yOf = (alter: number) => baseY + (topY - baseY) * (alter / peak);

  // Pre-bend: a vertical arrow at the onset. The curve then carries on from
  // the height it establishes.
  if (points[0].alter > 0) {
    const y = yOf(points[0].alter);
    primitives.push({
      kind: 'line',
      x1: startX, y1: baseY, x2: startX, y2: y + ARROWHEAD_SP,
      thickness: STROKE_SP,
      className: 'technique-bend technique-bend-prebend'
    });
    arrowhead('up', startX, 0, y, primitives);
    laneLabel(bendLabel(points[0].alter), startX, y - ARROWHEAD_SP - LABEL_GAP_SP,
      'technique-bend-label', primitives);
  }

  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    const from = { x: xOf(a.position), y: yOf(a.alter) };
    const to = { x: xOf(b.position), y: yOf(b.alter) };
    if (to.x <= from.x) continue;
    if (a.alter === b.alter) {
      // A hold: the string stays where it is, and the line says so.
      primitives.push({
        kind: 'line',
        x1: from.x, y1: from.y, x2: to.x, y2: to.y,
        thickness: STROKE_SP,
        className: 'technique-bend technique-bend-hold'
      });
      continue;
    }
    const rising = b.alter > a.alter;
    primitives.push({
      kind: 'curve',
      points: bendSegment(from, to),
      thickness: STROKE_SP,
      className: 'technique-bend' + (rising ? '' : ' technique-bend-release')
    });
    // The arrowhead marks where the gesture ARRIVES, so every segment that
    // moves gets one: a rise that is followed by a release has still arrived,
    // and printed editions draw both heads.
    arrowhead(rising ? 'up' : 'down', to.x, 0, to.y, primitives);
    if (rising) {
      laneLabel(bendLabel(b.alter), to.x, to.y - ARROWHEAD_SP - LABEL_GAP_SP,
        'technique-bend-label', primitives);
    }
  }
}

// ---------- Slides ----------

/**
 * A slide, on either staff.
 *
 * `shift` and `legato` name a destination and draw the line between the two
 * positions; `slideIn` and `slideOut` name none and draw the short approach or
 * departure. The two with a target differ only in whether the arrival is
 * re-picked — identical geometry, so `legato` adds the SLUR that says "one
 * pick", which is the convention MusicXML falls back on because it cannot
 * state the distinction at all.
 */
function emitSlide(
  input: TechniqueInput,
  site: TechniqueSite,
  slide: { type: string; direction?: 'up' | 'down'; target?: string },
  /** Where a LEGATO slide's extra slur goes — the one thing about a slide the
   *  two staves disagree on. */
  legatoSlur: (a: TechniqueSite, b: TechniqueSite) => { y: number; dir: 1 | -1 }
): void {
  const { byNoteId, ink, primitives } = input;
  const clear = site.halfWidthSp + CLEAR_SP;
  const className = `technique-slide technique-slide-${slide.type}`;

  if (slide.type === 'slideIn' || slide.type === 'slideOut') {
    // A slide INTO a note comes from before it; one OUT leaves after it. The
    // direction is the PITCH's, so "up" starts (or ends) below the note.
    const into = slide.type === 'slideIn';
    const dir = slide.direction ?? (into ? 'up' : 'down');
    const away = dir === 'up' ? SLIDE_STUB_RISE_SP : -SLIDE_STUB_RISE_SP;
    primitives.push({
      kind: 'line',
      x1: site.x, dx1: into ? -(clear + STUB_SP) : clear,
      y1: into ? site.y + away : site.y,
      x2: site.x, dx2: into ? -clear : clear + STUB_SP,
      y2: into ? site.y : site.y - away,
      thickness: STROKE_SP,
      className
    });
    return;
  }

  const target = slide.target ? byNoteId.get(slide.target) : undefined;
  if (!target || target.row !== site.row) {
    // Off the row, or absent: a stub in the direction of travel, rather than a
    // line drawn across a system break to a note that isn't there.
    const away = slide.direction === 'down' ? SLIDE_STUB_RISE_SP : -SLIDE_STUB_RISE_SP;
    primitives.push({
      kind: 'line',
      x1: site.x, dx1: clear, y1: site.y,
      x2: site.x, dx2: clear + STUB_SP, y2: site.y + away,
      thickness: STROKE_SP,
      className
    });
    return;
  }

  const targetClear = target.halfWidthSp + CLEAR_SP;
  // Flat ends get the slant of the direction they travel; ends at different
  // heights already say it themselves.
  const flat = target.y === site.y;
  const rising =
    site.fret !== undefined && target.fret !== undefined
      ? target.fret > site.fret
      : slide.direction !== 'down';
  const slant = flat ? (rising ? SLIDE_SLANT_SP : -SLIDE_SLANT_SP) : 0;
  primitives.push({
    kind: 'line',
    x1: site.x, dx1: clear, y1: site.y + slant,
    x2: target.x, dx2: -targetClear, y2: target.y - slant,
    thickness: STROKE_SP,
    className
  });

  if (slide.type === 'legato') {
    const { y, dir } = legatoSlur(site, target);
    slur(
      site.x + clear * ink, y,
      target.x - targetClear * ink, y,
      dir,
      'technique-slur technique-slide-legato-slur',
      primitives
    );
  }
}

// ---------- The tab staff ----------

/** Clearance between the top string line and the technique lane. */
const TAB_LANE_RISE_SP = 0.4;

/** Where a tab staff's technique lane sits, given its top string line. */
export function tabTechniqueLaneY(staffTop: number): number {
  return staffTop - TAB_LANE_RISE_SP;
}

/**
 * Technique on a tab staff: bends rising off the fret digits, slide lines
 * between them, hammer/pull slurs and their letters in the lane above, vibrato
 * wiggles, and the palm-mute run.
 *
 * Harmonics are NOT here — a harmonic changes the digit itself (`<12>`), so it
 * is drawn where the digit is, in `tabStaff.ts`. Only the type word for a
 * non-natural harmonic lands in the lane.
 */
export function emitTabTechnique(input: TechniqueInput): void {
  const { sites, byNoteId, ink, primitives } = input;

  for (const site of sites) {
    const t = site.technique;
    if (!t) continue;
    const lane = site.laneY;

    if (t.bend) emitBend(input, site, site.y, t.bend);

    if (t.vibrato) {
      const startDx = site.halfWidthSp + CLEAR_SP;
      wiggle(
        site.x, startDx,
        site.endX - CLEAR_SP * ink - (site.x + startDx * ink),
        lane, ink, primitives
      );
    }

    if (t.harmonic) {
      laneLabel(
        harmonicLabel(t.harmonic.type), site.x, lane - LANE_LABEL_DROP_SP,
        'technique-harmonic-label', primitives
      );
    }

    // Hammer-on / pull-off: a slur in the lane, lettered. Drawn ABOVE the
    // staff rather than between the digits, because on a tab staff the two
    // digits are usually on the SAME string line and a curve between them
    // would run along the very line it was drawn to sit off.
    for (const [kind, letter] of [['hammerOn', 'H'], ['pullOff', 'P']] as const) {
      const spec = t[kind];
      if (!spec) continue;
      const target = byNoteId.get(spec.target);
      if (!target) {
        // The target is not on the page — an id naming nothing, or a note this
        // staff could not place. Say the technique happened rather than
        // dropping it: the letter alone, over the note that carries it.
        laneLabel(letter, site.x, lane - LANE_LABEL_DROP_SP, `technique-${kind}-label`, primitives);
        continue;
      }
      drawSplit(
        input,
        { x: site.x, y: lane, row: site.row },
        { x: target.x, y: target.laneY, row: target.row },
        (x0, y0, x1, y1) => {
          slur(x0, y0, x1, y1, -1, `technique-slur technique-${kind}`, primitives);
          laneLabel(
            letter, (x0 + x1) / 2, Math.min(y0, y1) - SLUR_BULGE_SP - LABEL_GAP_SP,
            `technique-${kind}-label`, primitives
          );
        }
      );
    }

    if (t.slide) {
      emitSlide(input, site, t.slide, (a, b) => ({ y: Math.min(a.laneY, b.laneY), dir: -1 }));
    }
  }

  emitPalmMute(input, palmMuteRuns(sites));
}

// ---------- The notation staff ----------

/**
 * Technique on a notation staff.
 *
 * The same seven techniques, engraved the way a notation staff engraves them:
 * hammer/pull as a real slur between the noteheads (which is what the gesture
 * IS on this staff — one bow of sound over two pitches), a slide as the
 * straight line between them, and the marks with no pitch of their own — bend,
 * vibrato, palm mute, the harmonic circle — in the lane above.
 *
 * Drawing here at all answers the question the roadmap doc left open. The
 * technique block is drafted for standard MNX, not for tab: a document that
 * declares no strings has no fingerboard and so no tab staff, and if the
 * notation staff stayed silent its technique would be unrenderable rather than
 * merely unfretted.
 */
export function emitNotationTechnique(input: TechniqueInput): void {
  const { sites, byNoteId, ink, primitives } = input;

  for (const site of sites) {
    const t = site.technique;
    if (!t) continue;
    const lane = site.laneY;

    // A bend has no pitch of its own on this staff — there is no string to
    // watch it climb — so it rises from the lane rather than from the note.
    if (t.bend) emitBend(input, site, lane, t.bend);

    if (t.vibrato) {
      const startDx = site.halfWidthSp + CLEAR_SP;
      wiggle(
        site.x, startDx,
        site.endX - CLEAR_SP * ink - (site.x + startDx * ink),
        lane, ink, primitives
      );
    }

    if (t.harmonic) {
      // The small circle over the note — this staff's own word for a harmonic,
      // and the one mark here that is not the tab staff's.
      primitives.push({
        kind: 'glyph',
        glyph: 'stringsHarmonic',
        x: site.x,
        y: lane,
        anchor: 'middle',
        className: 'technique-harmonic'
      });
      laneLabel(
        harmonicLabel(t.harmonic.type), site.x, lane - HARMONIC_CIRCLE_SP - LABEL_GAP_SP,
        'technique-harmonic-label', primitives
      );
    }

    for (const [kind, letter] of [['hammerOn', 'H'], ['pullOff', 'P']] as const) {
      const spec = t[kind];
      if (!spec) continue;
      const target = byNoteId.get(spec.target);
      if (!target) {
        laneLabel(letter, site.x, lane - LANE_LABEL_DROP_SP, `technique-${kind}-label`, primitives);
        continue;
      }
      drawSplit(
        input,
        { x: site.x, y: site.y, row: site.row },
        { x: target.x, y: target.y, row: target.row },
        (x0, y0, x1, y1) => {
          // Away from the stem, hugging the outermost of the two noteheads on
          // that side — the placement an ordinary slur takes.
          const dir = slurSide(site);
          const edge =
            dir === -1
              ? Math.min(y0, y1) - SLUR_END_PAD_SP
              : Math.max(y0, y1) + SLUR_END_PAD_SP;
          slur(x0, edge, x1, edge, dir, `technique-slur technique-${kind}`, primitives);
          // The LETTER stays above the staff whichever side the slur took —
          // "H" under a downward slur would read as belonging to the staff
          // below it.
          laneLabel(
            letter, (x0 + x1) / 2, lane,
            `technique-${kind}-label`, primitives
          );
        }
      );
    }

    if (t.slide) {
      emitSlide(input, site, t.slide, (a, b) => {
        const dir = slurSide(a);
        return {
          y: dir === -1
            ? Math.min(a.y, b.y) - SLUR_END_PAD_SP
            : Math.max(a.y, b.y) + SLUR_END_PAD_SP,
          dir
        };
      });
    }
  }

  emitPalmMute(input, palmMuteRuns(sites));
}

// ---------- Collecting sites ----------

/**
 * The registry a layout fills while it emits. Kept here rather than in either
 * layout because both fill the same one and the post-pass reads the same one —
 * a tab staff and its notation sibling in the `both` view each keep their own,
 * since a mark belongs to the staff whose geometry it was measured against.
 */
export interface TechniqueCollector {
  sites: TechniqueSite[];
  byNoteId: Map<string, TechniqueSite>;
  /** Per voice, how many timed events have gone by — the palm-mute ordinal. */
  ordinals: Map<string, number>;
}

export function createTechniqueCollector(): TechniqueCollector {
  return { sites: [], byNoteId: new Map(), ordinals: new Map() };
}

/** Consumes this voice's next event ordinal. Called once per TIMED event,
 *  rests included, so a rest breaks a palm-mute run. */
export function nextOrdinal(collector: TechniqueCollector, voiceKey: string): number {
  const next = collector.ordinals.get(voiceKey) ?? 0;
  collector.ordinals.set(voiceKey, next + 1);
  return next;
}

/** Records one drawn note. A note with a real id is also indexed, because
 *  another note's technique may name it. */
export function recordSite(collector: TechniqueCollector, site: TechniqueSite): void {
  collector.sites.push(site);
  if (site.noteId !== undefined && !collector.byNoteId.has(site.noteId)) {
    collector.byNoteId.set(site.noteId, site);
  }
}

/** Does this collector hold anything worth a post-pass? */
export function hasTechniqueSites(collector: TechniqueCollector): boolean {
  return collector.sites.some(s => s.technique !== undefined);
}
