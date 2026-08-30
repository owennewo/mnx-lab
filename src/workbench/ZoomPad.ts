import { LitElement, html, css, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { designTokens, sharedChrome } from '../elements/tokens.ts';
import {
  BASELINE_PX_PER_SP,
  MIN_STAFF_SCALE,
  MAX_STAFF_SCALE,
  clampStaffScale
} from '../engine/render/scale.ts';
import {
  MIN_DENSITY,
  MAX_DENSITY,
  DENSITY_GRID,
  QUARTER_SPRING_SP,
  clampDensity
} from '../engine/layout/spacing.ts';

/**
 * The zoom/density pad — roadmap/complete/core-zoom-density-pad.md, campaign
 * item 9 of core-campaign-modernist.md, from the design project's
 * `Zoom Control.dc.html`.
 *
 * Two axes that are genuinely different things, which is why one control shows
 * both rather than pretending they are one slider:
 *
 *   ↑ ↓  STAFF   — a true scale. Line gap, glyphs, text and stems multiply
 *                  together, because everything downstream is in staff spaces
 *                  and `pxPerSp` is the single multiplier.
 *   ← →  SPACE   — horizontal distance between events only. Glyphs untouched:
 *                  the engine scales the springs and never the rigid columns,
 *                  which is what makes this axis independent of the other.
 *
 * The magnifier where the arms cross resets both.
 *
 * **This is chrome, not surface.** It composes `<mnx-document-viewer>`'s
 * attributes and implements no presentation behavior of its own — every value
 * it emits is clamped by the engine that owns it (`clampStaffScale`,
 * `clampDensity`). The layering rule is docs/core-viewer-surface.md's.
 *
 * The quiet state is the place the design was revised three times. The spec idles
 * the FULL 3×3 grid at 72×72 and opacity 0.28 — about a bar of music, and
 * faint is not absent — so the first revision drew the crosshair as a single
 * 24×24 glyph: 89% less area, same identity. The second (2026-08-20) made the
 * two states ONE geometry so they morph instead of swapping DOM: the readout
 * moved from below the grid to its left and the grid tracks collapse until the
 * four arms form the 24×24 crosshair. The third closes the numeric column
 * completely at rest, even off-default, so the adjacent focus and zoom marks
 * are comparable squares. Same buttons in both poses, tracks/transforms/
 * opacity only, and hover costs 72px of height where the stacked layout cost
 * 100.
 */

/** Design: staff step 5%, spacing step 4%. Both ranges are the ENGINE's.
 *
 *  SPACE_STEP is now a MINIMUM rather than the step: with a ladder supplied
 *  (see `densitySteps`) the arm lands on the first rung at least this far away,
 *  so a click never does nothing and never does less than the design asked.
 *
 *  STAFF_STEP became a RATIO on 2026-08-21, when the staff ceiling went to
 *  640% for low-vision readers. The design's 5% was additive, which is fine
 *  across 60–160% and wrong across 60–640%: additively, one click at 640% is a
 *  0.8% change (invisible) while at 60% it is 8% (coarse), and crossing the
 *  range takes 108 clicks — which would have made the new ceiling unreachable
 *  in practice, i.e. a fake fix for the reader it was raised for. A constant
 *  RATIO is what every zoom control in existence uses, for this reason: equal
 *  perceptual steps at every scale, and ~25 clicks (or one 150px drag) end to
 *  end. 1.1 keeps the design's feel at the default — the first click off 100%
 *  moves 10%, against the old 5% — while staying honest at the top. */
const STAFF_STEP_RATIO = 1.1;
const SPACE_STEP = 0.04;

/** Float slack when comparing against ladder rungs (they are 1% grid values). */
const RUNG_EPS = 1e-6;

/** Drag: ±1 step per 6px, halved with shift; axis-locks after 8px of travel
 *  if that travel is within 20° of an axis. All three from the design. */
const DRAG_PX_PER_STEP = 6;
const AXIS_LOCK_PX = 8;
const AXIS_LOCK_TAN = Math.tan((20 * Math.PI) / 180);

/** Click-and-hold repeat, per the design's 400ms. */
const REPEAT_DELAY_MS = 400;
const REPEAT_EVERY_MS = 60;

export type ZoomAxis = 'staff' | 'space';

export interface ZoomPadChange {
  /** null = fitted: no pxPerSp is sent and the renderer fits to the viewport. */
  staffScale: number | null;
  /** null = the element's `density` preset decides. */
  densityH: number | null;
}

/** Round to the step grid so repeated ±0.05 cannot drift into 0.8500000001. */
function snap(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * `steps` geometric staff steps from `from`, snapped to the 1% grid the
 * readout prints. Rounding keeps repeated ×1.1 ÷1.1 from drifting, and the
 * grid is fine enough that a step is never swallowed by it (1% of the 60%
 * floor is 0.6 of a step).
 */
function staffAfterSteps(from: number, steps: number): number {
  return Math.round(from * Math.pow(STAFF_STEP_RATIO, steps) * 100) / 100;
}

@customElement('mnx-zoom-pad')
export class ZoomPad extends LitElement {
  /** Staff scale, or null for fitted. Mirrors the viewer's `zoom`. */
  @property({ type: Number }) staffScale: number | null = null;
  /** Spacing multiplier, or null for the preset. Mirrors `density-h`. */
  @property({ type: Number }) densityH: number | null = null;

  /**
   * What the last paint actually used, from the viewer's `render-scale`.
   * While `staffScale` is null this is the ONLY honest number to print — the
   * renderer fitted the score and the value moves with the viewport.
   */
  @property({ type: Number }) effectiveStaffScale = 1;

  /**
   * The spacing values that actually change the score on screen, ascending —
   * `<mnx-document-viewer>.densitySteps()`, passed in as a getter because it moves
   * with every paint (viewport width, staff scale, the document itself).
   *
   * The ← → arms walk THIS, not a fixed percentage. The reason is the whole
   * point of the axis: on a justified score most density values engrave
   * identically, because the justifier hands back exactly what density took
   * away, so stepping blindly means clicking *tighter* three times and
   * watching nothing move. Rungs are the values where the packing really
   * changes — where a bar moves to another system.
   *
   * Unset (or returning null) falls back to the flat SPACE_STEP: the pad stays
   * a self-contained control, and a host without a viewer to ask still gets
   * the axis.
   */
  @property({ attribute: false }) densitySteps: (() => number[] | null) | null = null;

  /** Workbench composition state. The pad does not own focus mode; it only
   *  reflects the host's state so its adjacent control can request the
   *  opposite. This remains chrome around, not API on, the document viewer. */
  @property({ type: Boolean, reflect: true, attribute: 'document-focus' })
  documentFocus = false;

  /**
   * The tray is open over the score. The design: *"the pad drops to 0.28 for
   * as long as the tray is open — the selection is the more urgent thing."*
   * Forces the quiet state even under the pointer.
   */
  @property({ type: Boolean, reflect: true }) suppressed = false;

  @state() private open = false;
  /**
   * The pane has stopped giving the staff axis anything: the last increase in
   * the REQUEST left the DRAWN scale where it was. Above about 200% on a
   * narrow pane the shrink-to-fit grows with the ask (see `shownStaff`) and
   * the two cancel almost exactly, so the arm eventually buys nothing at all —
   * and an arm that buys nothing should say so, which is the same rule the
   * spacing arms follow against the density ladder.
   *
   * Discovered rather than predicted: predicting it would mean laying the
   * score out at the next scale to find out. One click that does not move the
   * number is what greys the arm, and any paint that DOES move the number —
   * a wider window, another document, a step back down — clears it again.
   */
  @state() private staffSaturated = false;
  @state() private dragging = false;
  /** The axis that just hit its clamp — drives the MIN/MAX band. */
  @state() private clamped: { axis: ZoomAxis; at: 'min' | 'max' } | null = null;

  private repeatTimer: number | null = null;
  /**
   * Whether the last COMMITTED render was the expanded pose. The gesture
   * handlers gate on this rather than on reactive state: on touch,
   * pointerenter and pointerdown arrive together, so state already says
   * "expanded" while the screen still shows the 24px mark — and an arm the
   * user cannot see must not step the score. First contact opens; the next
   * one operates. (Mouse hover renders the pad long before the click, so the
   * gate never bites there.)
   */
  private renderedExpanded = false;
  private drag: {
    pointerId: number;
    x0: number;
    y0: number;
    /** Steps already applied, so accumulation is absolute, not incremental. */
    dx: number;
    dy: number;
    lock: ZoomAxis | 'both' | null;
    moved: boolean;
    staff0: number;
    space0: number;
  } | null = null;

  static styles = [
    designTokens,
    sharedChrome,
    css`
      :host {
        display: block;
        font-family: var(--sans);
        /* The 44px grabbable area the design asks for, around a 24px mark:
           the padding is part of the target, so the mark is catchable before
           it is legible. Negative margins keep the VISUAL inset at the 14px
           ScenarioPage sets, rather than 14 + the padding. */
        padding: 10px;
        margin: -10px;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
      }

      .cluster {
        display: flex;
        align-items: flex-start;
        gap: 5px;
      }

      /* A focus mode must carry its own visible way out. This button is a
         sibling of the zoom geometry rather than part of the viewer: both are
         workbench chrome composed over ScenarioPage's document surface. */
      button.focus-toggle {
        order: -1;
        flex: none;
        appearance: none;
        box-sizing: border-box;
        width: 26px;
        height: 26px;
        margin: 0;
        padding: 0;
        border: var(--rule-w) solid var(--line);
        border-radius: var(--radius-control);
        display: grid;
        place-items: center;
        background: var(--surface);
        color: var(--ink);
        opacity: 0.55;
        cursor: pointer;
        box-shadow: 0 2px 4px var(--shadow-far);
        transition:
          opacity 0.12s ease,
          color 0.12s ease,
          border-color 0.12s ease,
          background-color 0.12s ease;
      }

      :host([document-focus]) button.focus-toggle {
        opacity: 1;
        border-color: var(--ink);
      }

      button.focus-toggle:hover,
      button.focus-toggle:focus-visible {
        opacity: 1;
        color: var(--accent);
        background: var(--row-current);
      }

      button.focus-toggle:focus-visible {
        outline: var(--rule-w) solid var(--focus-ring);
        outline-offset: 2px;
      }

      button.focus-toggle svg {
        display: block;
      }

      /* ── one pad, two poses ──
         Idle is not a different element: it is this same pad with its chrome
         transparent, its readout labels closed and its grid tracks collapsed
         until the four arms form the 24×24 crosshair. Everything between the
         poses is a transition on tracks, transforms and opacity — that is the
         whole morph. Right edge is the anchor (margin-left: auto), so the pad
         grows leftward and downward from the mark. */
      .pad {
        display: flex;
        width: max-content;
        margin-left: auto;
        box-sizing: border-box;
        background: transparent;
        border: var(--rule-w) solid transparent;
        border-radius: var(--radius-card);
        box-shadow: 0 2px 4px transparent, 0 12px 30px transparent;
        opacity: 0.28;
        transition:
          opacity 0.12s ease,
          background-color 0.16s ease,
          border-color 0.16s ease,
          box-shadow 0.16s ease;
      }

      /* Off default: the IDLE floor rises and the changed arm prints in the
         accent, so the score never lies about its own scale.

         The :not(.expanded) is load-bearing, not decoration. :host([data-off])
         .pad outweighs .pad.expanded (0,3,0 against 0,2,0), so without it the
         raised floor also applied to the OPEN pad: hover a pad on a score that
         had been zoomed or respaced — the only time the readout has numbers
         worth reading — and the whole card sat at 0.55, i.e. the staff lines
         and fret digits showed straight through the panel and its type.
         Scoping the rule to the idle pose says what it always meant. */
      :host([data-off]) .pad:not(.expanded) {
        opacity: 0.55;
      }

      .pad.expanded {
        background: var(--surface);
        border-color: var(--ink);
        box-shadow: 0 2px 4px var(--shadow-far), 0 12px 30px var(--shadow-far);
        opacity: 1;
      }

      :host([suppressed]) .pad {
        opacity: 0.28;
      }

      /* ── the readout: an open-state left-hand column ──

         Open, the column gets a GROUND of its own (--bg-context) rather than
         sharing the pad's --surface. The reason is a collision the token
         sheet makes exactly: --surface and --paper are the same value in both
         themes (white / oklch(0.23…)), so a pad filled with --surface over the
         score is a card whose fill is indistinguishable from the paper it
         covers — the staff lines run up to its edge and read as passing UNDER
         the numbers. One step of ground under the readout is what stops the
         digits reading as ink lying on the music. */
      .readout {
        box-sizing: border-box;
        width: 60px;
        height: 72px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-right: var(--rule-w) solid transparent;
        transition:
          width 0.16s ease,
          height 0.16s ease,
          opacity 0.12s ease,
          background-color 0.16s ease,
          border-color 0.16s ease;
      }

      .pad.expanded .readout {
        background: var(--bg-context);
        border-color: var(--ink);
      }

      .pad:not(.expanded) .readout {
        width: 0;
        height: 0;
        border-right-width: 0;
        opacity: 0;
      }

      .half {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        justify-content: center;
        padding: 0 6px;
        white-space: nowrap;
        border-top: 1px solid transparent;
        transition: border-color 0.16s ease;
      }

      .pad.expanded .half + .half {
        border-color: var(--line);
      }

      /* The labels collapse with the readout so the open pose still morphs
         from the square mark rather than appearing as unrelated DOM. */
      .lbl {
        font: 600 8px/1 var(--sans);
        letter-spacing: 0.09em;
        /* --ink-2, not --ink-3. The label names which axis the number belongs
           to, so it is read every time the number is — a muted-caption grey at
           8px is the wrong job for it. Still a step under the value, which is
           what keeps the pair a label-and-value rather than two headlines. */
        color: var(--ink-2);
        height: 11px;
        overflow: hidden;
        transition:
          height 0.16s ease,
          opacity 0.12s ease;
      }

      .pad:not(.expanded) .lbl {
        height: 0;
        opacity: 0;
      }

      /* The readout exists only in the expanded pose, where 13px is the size
         at which the two percentages are actually legible. */
      .val {
        font: 600 13px/1.25 var(--mono);
        color: var(--ink);
      }

      .val.hot {
        color: var(--accent);
      }

      /* Fitted used to be marked twice — the value in --ink-3 and the label
         reading FIT — and both are gone. The grey made the two halves disagree
         for no reason a reader could act on (reset the pad and the staff number
         went grey while the spacing number beside it stayed full ink, though
         neither had been chosen); the word made the axis rename itself under a
         click that was supposed to reset it, and FIT names a mode the reader
         never asked for rather than the thing the number measures. The labels
         are now CONSTANT — STAFF and SPACE, always — and .hot carries the whole
         distinction: accent means you chose this value, plain ink means the
         renderer did. The title spells the rest out in a sentence. */

      /* The clamp band, now per-axis: the half that hit its wall turns ink and
         its label becomes the verdict, while the other axis stays readable —
         which the old full-width chip could not do. Same geometry as the plain
         half, so nothing reflows. */
      .half.limit {
        background: var(--ink);
      }

      .half.limit .lbl {
        color: var(--accent-on-ink);
        letter-spacing: 0.06em;
      }

      .half.limit .val {
        color: var(--surface);
      }

      /* ── the grid ──
         Collapsed tracks ARE the idle crosshair: 3×8px cells with the arrows
         scaled down land the four arms on the old single-glyph footprint. The
         magnifier — mush at 3px of clear centre — waits for the tracks to
         open. */
      .grid {
        display: grid;
        grid-template-columns: repeat(3, 8px);
        grid-template-rows: repeat(3, 8px);
        transition:
          grid-template-columns 0.16s ease,
          grid-template-rows 0.16s ease;
      }

      .pad.expanded .grid {
        grid-template-columns: repeat(3, 24px);
        grid-template-rows: repeat(3, 24px);
      }

      /* Corners are empty and carry NO hit area — the design is explicit, and
         a diagonal press would otherwise mean two axes at once by accident. */
      .grid .gap {
        pointer-events: none;
      }

      button.cell {
        appearance: none;
        margin: 0;
        padding: 0;
        border: 0;
        background: none;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: visible;
        cursor: pointer;
        color: var(--ink);
        transition:
          background-color 0.12s ease,
          color 0.12s ease;
      }

      .cell svg {
        display: block;
        flex: none;
        transition: transform 0.16s ease;
      }

      .pad:not(.expanded) .cell svg {
        transform: scale(0.62);
      }

      /* Idle paints a pinned axis in the accent — the arms are the mark now. */
      .pad:not(.expanded) .cell.hot {
        color: var(--accent);
      }

      .pad.expanded button.cell:hover:not(:disabled),
      .pad.expanded button.cell:focus-visible {
        background: var(--row-current);
        color: var(--accent);
      }

      .pad.expanded button.cell:focus-visible {
        outline: var(--rule-w) solid var(--focus-ring);
        outline-offset: -2px;
      }

      /* The exhausted arm greys; the live arm keeps the accent. */
      button.cell:disabled {
        cursor: default;
      }

      .pad.expanded button.cell:disabled {
        background: var(--bg-context);
        color: var(--ink-faint);
      }

      .up { border-bottom: 1px solid transparent; }
      .down { border-top: 1px solid transparent; }
      .left { border-right: 1px solid transparent; }
      .right { border-left: 1px solid transparent; }

      .pad.expanded .up,
      .pad.expanded .down,
      .pad.expanded .left,
      .pad.expanded .right {
        border-color: var(--line);
      }

      .mag svg {
        transition:
          transform 0.16s ease,
          opacity 0.12s ease;
      }

      .pad:not(.expanded) .mag {
        pointer-events: none;
      }

      .pad:not(.expanded) .mag svg {
        transform: scale(0.3);
        opacity: 0;
      }

      @media (prefers-reduced-motion: reduce) {
        .pad,
        .readout,
        .half,
        .lbl,
        .val,
        .grid,
        button.cell,
        .cell svg,
        .mag svg {
          transition: none;
        }

        button.focus-toggle {
          transition: none;
        }
      }
    `
  ];

  // ── values ──────────────────────────────────────────────────────────────

  /**
   * What the staff readout PRINTS: the scale on the screen, always — never the
   * one that was asked for.
   *
   * They can differ, and the case where they do is the one a reader is most
   * likely to be in when they care. The pane clips nothing and scrolls
   * nowhere: a drawing wider than it is scaled down to fit (`max-width: 100%`
   * on the score's svg), and since a large staff scale prices the rigid
   * columns wider as well as taller, the shrink grows with the ask and the two
   * nearly cancel. Asking 320% drew 268%, asking 640% drew 297% — reported as
   * *"vertical spacing 320 doesn't seem half of 640"*, which it was not.
   * `<mnx-document-viewer>` measures the shrink and reports the product, so this
   * number is the staff in front of you.
   */
  private get shownStaff(): number {
    return this.effectiveStaffScale;
  }

  /**
   * What the ARMS move: the pinned request, else the scale last drawn.
   *
   * Deliberately not `shownStaff`. Stepping from the drawn number would walk
   * the request backwards the moment the two diverge — press ↑ at a pinned
   * 640% that draws 297% and the next value would be 327%, i.e. a smaller ask
   * than the one already in force. The reader still sees the truth; the
   * control still edits what they set.
   */
  private get requestedStaff(): number {
    return this.staffScale ?? this.effectiveStaffScale;
  }

  private get shownSpace(): number {
    return this.densityH ?? 1;
  }

  private get offDefault(): boolean {
    return this.staffScale !== null || this.densityH !== null;
  }

  // ── stepping ────────────────────────────────────────────────────────────

  /**
   * Move one axis by `steps`, clamp through the ENGINE's own bounds, and
   * report a clamp that actually bit. Stepping from `requestedStaff` is what makes
   * the first click off a fitted score continue from what is on screen rather
   * than jumping to 100%.
   */
  private step(axis: ZoomAxis, steps: number) {
    if (steps === 0) return;
    if (axis === 'staff') {
      const next = staffAfterSteps(this.requestedStaff, steps);
      const clampedTo = clampStaffScale(next)!;
      this.noteClamp('staff', next, clampedTo, MIN_STAFF_SCALE, MAX_STAFF_SCALE);
      this.commit({ staffScale: clampedTo, densityH: this.densityH });
    } else {
      const dir = steps > 0 ? 1 : -1;
      const walk = this.walkSpace(this.shownSpace, Math.abs(steps), dir);
      this.clamped = walk.exhausted ? { axis: 'space', at: dir < 0 ? 'min' : 'max' } : null;
      if (walk.value !== this.densityH) {
        this.commit({ staffScale: this.staffScale, densityH: walk.value });
      }
    }
  }

  /**
   * The ladder to walk, or null when there is nobody to ask.
   *
   * A ladder of ONE rung is not "nothing to walk", it is the answer: this
   * score has a single engraving across the entire density range, so both arms
   * are exhausted and must say so. It used to fall through to the flat step
   * here, which is how the axis went dead-but-clickable at high staff scales —
   * where one bar fills a system, every row is justified to the margin and
   * density has nothing left to move (2026-08-21).
   */
  private ladder(): number[] | null {
    const steps = this.densitySteps?.() ?? null;
    return steps && steps.length > 0 ? steps : null;
  }

  /**
   * The next spacing value in `dir` — the next value that DRAWS something
   * different — or null when this arm has nothing left to reach.
   *
   * A rung is the low edge of its run, so any value between two rungs engraves
   * what the lower one engraves; stepping to it would be exactly the invisible
   * click this walk exists to skip. Hence "the run `from` sits in", not "the
   * nearest rung". Within what is left, the first rung at least SPACE_STEP
   * away wins — a dense ladder must not turn the design's 4% step into 1%.
   *
   * Going DOWN, the rung itself is the wrong place to land. A run can be very
   * wide — at a large staff scale everything from 2% to 66% draws the same
   * page — and its low edge is the far side of it, so landing on the rung
   * turned one click of "a bit tighter" into 67 → 2. The arm lands on the near
   * side instead: as far as it has to go to change the engraving, and no
   * further, which is `from - SPACE_STEP` when that already sits inside the
   * run and the run's top edge when it does not. Going up, the rung IS the
   * near side, so that direction is unchanged.
   */
  private nextSpace(dir: 1 | -1, from: number): number | null {
    const ladder = this.ladder();
    if (!ladder) {
      const next = clampDensity(snap(from + dir * SPACE_STEP, SPACE_STEP));
      return next === from ? null : next;
    }
    let cur = -1;
    while (cur + 1 < ladder.length && ladder[cur + 1] <= from + RUNG_EPS) cur++;
    if (dir > 0) {
      const ahead = ladder.slice(cur + 1);
      if (ahead.length === 0) return null;
      return ahead.find(v => v - from >= SPACE_STEP - RUNG_EPS) ?? ahead[0];
    }
    const below = ladder.slice(0, Math.max(0, cur));
    if (below.length === 0) return null;
    const rung =
      [...below].reverse().find(v => from - v >= SPACE_STEP - RUNG_EPS) ?? below[below.length - 1];
    const index = ladder.indexOf(rung);
    // The top of that run: one grid step under the next rung up. There is
    // always a next one — `rung` came from strictly below the current run.
    const top = Math.round((ladder[index + 1] - DENSITY_GRID) * 100) / 100;
    return Math.max(rung, Math.min(top, Math.round((from - SPACE_STEP) * 100) / 100));
  }

  /** `steps` rungs from `from`, stopping where the arm runs out. Absolute from
   *  a starting value, so a drag out and back returns to where it started. */
  private walkSpace(from: number, steps: number, dir: 1 | -1) {
    let value = from;
    for (let i = 0; i < steps; i++) {
      const next = this.nextSpace(dir, value);
      if (next === null) return { value, exhausted: true };
      value = next;
    }
    return { value, exhausted: false };
  }

  /** The clamp used to be silent — a host asking for 0.2 got 0.5 and was never
   *  told. Surfacing it is this control's real contribution to the axis. */
  private noteClamp(axis: ZoomAxis, wanted: number, got: number, min: number, max: number) {
    if (wanted < got && got === min) this.clamped = { axis, at: 'min' };
    else if (wanted > got && got === max) this.clamped = { axis, at: 'max' };
    else this.clamped = null;
  }

  private commit(change: ZoomPadChange) {
    this.staffScale = change.staffScale;
    this.densityH = change.densityH;
    this.dispatchEvent(
      new CustomEvent<ZoomPadChange>('zoom-change', {
        detail: change,
        bubbles: true,
        composed: true
      })
    );
  }

  private reset() {
    this.clamped = null;
    // Back to BOTH defaults — and the staff default is fitted, not 100%.
    this.commit({ staffScale: null, densityH: null });
  }

  // ── gestures ────────────────────────────────────────────────────────────

  private onArmDown(event: PointerEvent, axis: ZoomAxis, dir: 1 | -1) {
    // Left button only; let anything else fall through to the page.
    if (event.button !== 0) return;
    if (!this.renderedExpanded) {
      this.open = true;
      return;
    }
    event.preventDefault();
    this.step(axis, dir);
    this.startRepeat(axis, dir);
    this.beginDrag(event);
  }

  private startRepeat(axis: ZoomAxis, dir: 1 | -1) {
    this.stopRepeat();
    this.repeatTimer = window.setTimeout(() => {
      this.repeatTimer = window.setInterval(() => this.step(axis, dir), REPEAT_EVERY_MS);
    }, REPEAT_DELAY_MS);
  }

  private stopRepeat() {
    if (this.repeatTimer === null) return;
    // One handle, two timer kinds — clearing both is cheaper than tracking
    // which phase it was in, and clearing the wrong kind is a no-op.
    window.clearTimeout(this.repeatTimer);
    window.clearInterval(this.repeatTimer);
    this.repeatTimer = null;
  }

  private beginDrag(event: PointerEvent) {
    this.drag = {
      pointerId: event.pointerId,
      x0: event.clientX,
      y0: event.clientY,
      dx: 0,
      dy: 0,
      lock: null,
      moved: false,
      staff0: this.requestedStaff,
      space0: this.shownSpace
    };
    this.dragging = true;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  private onPadDown(event: PointerEvent) {
    // Only bare pad ground — the arms and the magnifier handle their own.
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    if (!this.renderedExpanded) {
      this.open = true;
      return;
    }
    event.preventDefault();
    this.beginDrag(event);
  }

  private onPointerMove(event: PointerEvent) {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;

    const dx = event.clientX - drag.x0;
    const dy = event.clientY - drag.y0;
    const travel = Math.hypot(dx, dy);

    if (!drag.moved && travel > 2) {
      drag.moved = true;
      // A real drag supersedes the click's hold-repeat.
      this.stopRepeat();
    }

    // Axis lock is decided ONCE, on the first 8px of travel, and then held —
    // deciding it per move would let a curving drag flip axes mid-gesture.
    if (drag.lock === null && travel >= AXIS_LOCK_PX) {
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (ay <= ax * AXIS_LOCK_TAN) drag.lock = 'space';
      else if (ax <= ay * AXIS_LOCK_TAN) drag.lock = 'staff';
      else drag.lock = 'both';
    }
    if (drag.lock === null) return;

    const rate = event.shiftKey ? DRAG_PX_PER_STEP * 2 : DRAG_PX_PER_STEP;
    // Absolute from the gesture's origin, so a drag out and back returns to
    // where it started instead of ratcheting.
    const staffSteps = drag.lock === 'space' ? 0 : Math.round(-dy / rate);
    const spaceSteps = drag.lock === 'staff' ? 0 : Math.round(dx / rate);

    const wantStaff = staffAfterSteps(drag.staff0, staffSteps);
    const gotStaff = clampStaffScale(wantStaff)!;
    // Same walk the arms take, so a drag and a click agree on what a step is:
    // rungs, not percentages.
    const space = this.walkSpace(drag.space0, Math.abs(spaceSteps), spaceSteps >= 0 ? 1 : -1);
    const gotSpace = space.value;

    // Report the axis the user is actually pushing against.
    if (drag.lock !== 'staff' && space.exhausted) {
      this.clamped = { axis: 'space', at: spaceSteps >= 0 ? 'max' : 'min' };
    } else if (drag.lock !== 'space' && gotStaff !== wantStaff) {
      this.noteClamp('staff', wantStaff, gotStaff, MIN_STAFF_SCALE, MAX_STAFF_SCALE);
    } else {
      this.clamped = null;
    }

    const nextStaff = drag.lock === 'space' ? this.staffScale : gotStaff;
    const nextSpace = drag.lock === 'staff' ? this.densityH : gotSpace;
    if (nextStaff !== this.staffScale || nextSpace !== this.densityH) {
      this.commit({ staffScale: nextStaff, densityH: nextSpace });
    }
  }

  private onPointerUp(event: PointerEvent) {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    this.stopRepeat();
    this.drag = null;
    this.dragging = false;
    this.clamped = null;
  }

  private onMagnifier(event: PointerEvent) {
    if (event.button !== 0) return;
    if (!this.renderedExpanded) {
      this.open = true;
      return;
    }
    event.preventDefault();
    this.beginDrag(event);
  }

  private onMagnifierUp() {
    // A press that never became a drag is a click: reset. Dragging FROM the
    // magnifier is still a drag, per "press and drag anywhere in the pad".
    if (this.drag && !this.drag.moved) this.reset();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopRepeat();
  }

  updated() {
    this.toggleAttribute('data-off', this.offDefault);
    this.renderedExpanded = !this.suppressed && (this.open || this.dragging);
    this.noteSaturation();
  }

  /** Compared at the readout's own precision — a change too small to print is
   *  too small to have been worth the click. */
  private lastAsk: { request: number; drawn: string } | null = null;

  private noteSaturation() {
    const seen = { request: this.requestedStaff, drawn: this.pct(this.effectiveStaffScale) };
    const previous = this.lastAsk;
    this.lastAsk = seen;
    if (!previous) return;
    if (seen.drawn !== previous.drawn || seen.request < previous.request) {
      this.staffSaturated = false;
    } else if (seen.request > previous.request) {
      this.staffSaturated = true;
    }
  }

  // ── marks ───────────────────────────────────────────────────────────────

  private arrow(dir: 'up' | 'down' | 'left' | 'right') {
    const paths = {
      up: 'M8.5 0 17 8h-5v7H5V8H0z',
      down: 'M8.5 15 0 7h5V0h7v7h5z',
      left: 'M0 8.5 8 0v5h7v7H8v5z',
      right: 'M15 8.5 7 17v-5H0V5h7V0z'
    };
    const vertical = dir === 'up' || dir === 'down';
    return svg`
      <svg
        width=${vertical ? 13 : 12}
        height=${vertical ? 12 : 13}
        viewBox=${vertical ? '0 0 17 15' : '0 0 15 17'}
        aria-hidden="true"
      >
        <path d=${paths[dir]} fill="currentColor"></path>
      </svg>
    `;
  }

  private magnifierGlyph() {
    return svg`
      <svg width="18" height="18" viewBox="0 0 22 22" aria-hidden="true">
        <circle cx="9.5" cy="9.5" r="7" fill="none" stroke="currentColor" stroke-width="2"></circle>
        <path d="M6 7.5h7M6 10h7M6 12.5h7" stroke="currentColor" stroke-width="1.1"></path>
        <path d="M14.6 14.6 21 21" stroke="currentColor" stroke-width="2"></path>
      </svg>
    `;
  }

  private focusGlyph() {
    const path = this.documentFocus
      ? 'M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5'
      : 'M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5';
    return svg`
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d=${path}
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="square"
        ></path>
      </svg>
    `;
  }

  private requestDocumentFocusToggle() {
    this.dispatchEvent(
      new CustomEvent('document-focus-request', { bubbles: true, composed: true })
    );
  }

  // ── render ──────────────────────────────────────────────────────────────

  private pct(value: number) {
    return String(Math.round(value * 100));
  }

  /**
   * What the numbers MEAN, on hover — because a bare percentage does not say
   * what it is a percentage OF, and both axes are measured in staff spaces
   * underneath.
   *
   * Staff: 100% is 10 CSS px per staff space (`BASELINE_PX_PER_SP`), so the
   * percentage IS the staff-space size — a four-space staff is 4× the number
   * this spells out. Fitted says so too, because that number moves with the
   * window rather than having been chosen.
   */
  private staffTitle(fitted: boolean): string {
    const px = this.shownStaff * BASELINE_PX_PER_SP;
    const size = `${Math.round(px * 10) / 10}px per staff space (100% = ${BASELINE_PX_PER_SP}px)`;
    const said = [`Staff size — ${size}.`];
    if (fitted) {
      said.push('Fitted to the window, so it moves when the window does.');
    } else if (this.staffScale !== null && this.pct(this.staffScale) !== this.pct(this.shownStaff)) {
      // The gap is the whole point of printing the drawn number, so name it
      // rather than leaving the reader to wonder why 640 says 297.
      said.push(
        `You asked for ${this.pct(this.staffScale)}%: at that size the page is wider ` +
          'than the pane, and it is scaled down to fit rather than scrolling sideways.'
      );
    }
    return said.join(' ');
  }

  /**
   * Space: a multiplier on the SPRINGS, whose unit is also staff spaces —
   * the ideal gap after a quarter note is `QUARTER_SPRING_SP` at 100%. The
   * sentence says "asks for" rather than naming the drawn gap on purpose: the
   * justifier stretches or squeezes every row to the line width afterwards, so
   * the sp figure is what the engraver requested, not what you can measure on
   * the page.
   */
  private spaceTitle(): string {
    const sp = Math.round(this.shownSpace * QUARTER_SPRING_SP * 100) / 100;
    return (
      `Note spacing — asks for ${sp} staff spaces after a quarter note ` +
      `(100% = ${QUARTER_SPRING_SP}), before each system is justified to the ` +
      `line. Glyph sizes are untouched.`
    );
  }

  /**
   * One axis of the readout, in both poses: open it is label-over-value, idle
   * the label closes and the bare number remains. A clamp turns THIS half into
   * the ink band; the other axis stays readable.
   */
  private renderHalf(axis: ZoomAxis) {
    const clamp = this.clamped?.axis === axis ? this.clamped : null;
    if (clamp) {
      const value = axis === 'staff' ? this.shownStaff : this.shownSpace;
      // MIN/MAX means the ENGINE's wall. The spacing arms can also run out
      // BEFORE it — past the last rung nothing tighter or wider draws anything
      // different — and calling that "MAX" would be claiming a clamp that
      // isn't there. Same band, honest word.
      const bound = clamp.at === 'min'
        ? value <= MIN_DENSITY + RUNG_EPS
        : value >= MAX_DENSITY - RUNG_EPS;
      const tag = clamp.at === 'min'
        ? (axis === 'staff' || bound ? 'MIN' : 'TIGHTEST')
        : (axis === 'staff' || bound ? 'MAX' : 'WIDEST');
      return html`
        <div class="half limit">
          <div class="lbl">${tag}</div>
          <div class="val">${this.pct(value)}</div>
        </div>
      `;
    }
    if (axis === 'staff') {
      const fitted = this.staffScale === null;
      return html`
        <div class="half" title=${this.staffTitle(fitted)}>
          <div class="lbl">STAFF</div>
          <div class="val ${fitted ? '' : 'hot'}">${this.pct(this.shownStaff)}</div>
        </div>
      `;
    }
    return html`
      <div class="half" title=${this.spaceTitle()}>
        <div class="lbl">SPACE</div>
        <div class="val ${this.densityH === null ? '' : 'hot'}">${this.pct(this.shownSpace)}</div>
      </div>
    `;
  }

  render() {
    // Dragging holds the pad open even when the pointer leaves it, and the
    // tray's claim on attention beats both.
    const expanded = !this.suppressed && (this.open || this.dragging);
    const staffHot = this.staffScale !== null;
    const spaceHot = this.densityH !== null;
    const atStaffMax = this.requestedStaff >= MAX_STAFF_SCALE || this.staffSaturated;
    const atStaffMin = this.requestedStaff <= MIN_STAFF_SCALE;
    // Greyed when the arm has nothing left to REACH, which on a ladder can
    // happen inside the engine's range: an arm that still moves a number the
    // score ignores is worse than an arm that says it is done.
    const atSpaceMax = this.nextSpace(1, this.shownSpace) === null;
    const atSpaceMin = this.nextSpace(-1, this.shownSpace) === null;

    return html`
      <div class="cluster">
        <div
          class="pad ${expanded ? 'expanded' : ''}"
          @pointerenter=${() => (this.open = true)}
          @pointerleave=${() => (this.open = false)}
          @focusin=${() => (this.open = true)}
          @focusout=${() => (this.open = false)}
          @pointerdown=${this.onPadDown}
          @pointermove=${this.onPointerMove}
          @pointerup=${this.onPointerUp}
          @pointercancel=${this.onPointerUp}
        >
          <div class="readout">
            ${this.renderHalf('staff')}
            ${this.renderHalf('space')}
          </div>
          <div class="grid">
            <div class="gap"></div>
            <button
              class="cell up ${staffHot ? 'hot' : ''}"
              ?disabled=${atStaffMax}
              title=${this.staffSaturated && this.requestedStaff < MAX_STAFF_SCALE
                ? 'Larger staff — asking for more stopped changing the drawn size: the page is already being scaled down to fit the pane'
                : 'Larger staff'}
              aria-label="Larger staff"
              @pointerdown=${(e: PointerEvent) => this.onArmDown(e, 'staff', 1)}
            >
              ${this.arrow('up')}
            </button>
            <div class="gap"></div>

            <button
              class="cell left ${spaceHot ? 'hot' : ''}"
              ?disabled=${atSpaceMin}
              title="Tighter spacing"
              aria-label="Tighter spacing"
              @pointerdown=${(e: PointerEvent) => this.onArmDown(e, 'space', -1)}
            >
              ${this.arrow('left')}
            </button>
            <button
              class="cell mag"
              title="Reset zoom and spacing"
              aria-label="Reset zoom and spacing"
              @pointerdown=${this.onMagnifier}
              @pointerup=${this.onMagnifierUp}
            >
              ${this.magnifierGlyph()}
            </button>
            <button
              class="cell right ${spaceHot ? 'hot' : ''}"
              ?disabled=${atSpaceMax}
              title="Wider spacing"
              aria-label="Wider spacing"
              @pointerdown=${(e: PointerEvent) => this.onArmDown(e, 'space', 1)}
            >
              ${this.arrow('right')}
            </button>

            <div class="gap"></div>
            <button
              class="cell down ${staffHot ? 'hot' : ''}"
              ?disabled=${atStaffMin}
              title="Smaller staff"
              aria-label="Smaller staff"
              @pointerdown=${(e: PointerEvent) => this.onArmDown(e, 'staff', -1)}
            >
              ${this.arrow('down')}
            </button>
            <div class="gap"></div>
          </div>
        </div>
        <button
          class="focus-toggle"
          title=${this.documentFocus
            ? 'Exit document focus (Ctrl+Alt+F)'
            : 'Focus document (Ctrl+Alt+F)'}
          aria-label=${this.documentFocus ? 'Exit document focus' : 'Focus document'}
          aria-pressed=${this.documentFocus}
          @click=${this.requestDocumentFocusToggle}
        >
          ${this.focusGlyph()}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mnx-zoom-pad': ZoomPad;
  }
}
