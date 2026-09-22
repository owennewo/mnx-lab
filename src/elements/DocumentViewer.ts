import { engravingEntries } from '../engine/layout/unrolled.ts';
import { occurrenceKey, parseOccurrenceKey } from '../model/noteKeys.ts';
import { forEachNoteAddress } from '../model/noteWalk.ts';
import { restSpansOf } from '../model/restSpans.ts';
import type { MnxStructure } from '../model/mnx.ts';
import { withHiddenParts, type VisibleParts } from '../model/partVisibility.ts';
import { paintPlaybackInk } from '../engine/render/playbackInk.ts';
import { normalizeDisplayOptions, type DisplayOptions } from '../engine/displayOptions.ts';
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  mnxDocumentContext,
  playbackStateContext,
  selectionContext
} from './mnxContext.ts';
import type { PlaybackState, PlaybackOccurrence, SelectionContext } from './mnxContext.ts';
import {
  MnxDocument,
  MnxPart,
  MnxTuningEntry,
  declaredStaffKind,
  documentArtist,
  documentTitle
} from '../model/mnx.ts';
import {
  resolveTabSetup,
  tabPositionContext,
  type PartTabSetups,
  type TabSetup
} from '../engine/tab/guitarPositions.ts';
import { renderMnxToSvgTab } from '../engine/tab/tabRenderer.ts';
import { renderMnxToSvgNotation } from '../engine/notation/notationRenderer.ts';
import { renderMnxToSvgBoth } from '../engine/both/bothRenderer.ts';
import { getSmuflData, isSmuflLoaded, loadSmufl } from '../engine/smufl/smufl.ts';
import { emitPlan, type RenderPlan } from '../engine/render/plan.ts';
import type { LayoutReply, LayoutRequest, PlanInputs, PlanRequest } from './layout.worker.ts';
import { isTextEntry } from './keyScope.ts';
import {
  clampStaffSp,
  renderScale,
  type RenderOutcome,
  type RenderScale
} from '../engine/render/scale.ts';
import { SPACE_DEFAULT_SP, densityLadder, packedRowMeasures, spacePolicy, type PackingInput } from '../engine/layout/spacing.ts';
import { ScoreGestures, type GestureTargets } from './gestures.ts';
import { DEFAULT_SPACE_SP, DEFAULT_STAFF_SP } from './zoomDefaults.ts';
import { createLayoutCache } from '../engine/render/layoutCache.ts';
import { SCORE_LABEL_SIZE_SP } from '../engine/layout/scoreText.ts';
import { revealScrollDelta } from '../engine/render/revealScroll.ts';
import {
  drawCursorGhost,
  drawEnclosure,
  markProjectionEchoes,
  snapshotEnclosure,
  tweenEnclosure
} from './enclosure.ts';
import {
  buildPointerMap,
  drawPointerGhost,
  hitTest,
  ordinalsOf,
  type PointerPlacement,
  type RenderedStaff,
  type ScorePointerMap
} from './pointerHitTest.ts';
import { unitsPerSp } from './scoreGeometry.ts';
import type { RenderedProjection } from '../engine/render/projection.ts';
// The view-mode axis belongs to the embeddable surface: the shell's toolbar
// imports it from here, never the other way around.
/** The projections the engine can draw. */
export type ViewMode = 'notation' | 'tab' | 'both';

/** What a host may ASK for: a projection, or `auto` — "defer to the document"
 *  (docs/core-viewer-surface.md). Unset is not a value; it is a deferral. */
export type ViewSetting = ViewMode | 'auto';

/** Named horizontal densities. The engine's knob is Space in staff spaces —
 *  the air after a quarter note (core-space-units-sp.md); these are the three
 *  values worth a name (core-render-density-zoom.md). */
export type DensityPreset = 'compact' | 'normal' | 'spacious';

const DENSITY_H: Record<DensityPreset, number> = {
  compact: 1.4,
  normal: SPACE_DEFAULT_SP,
  spacious: 3.3
};
import { sharedChrome, scrollbars, viewerTokens } from './tokens.ts';
import type { HideableFeature } from '../engine/layout/notation.ts';

/**
 * The document viewer: a scrollable bench with a warm PAPER card at its centre.
 * The paper carries the engraved SVG (the rendering engine is a black box
 * here), or one of two honest state panels:
 *  - invalid-by-design → the spec-gap exhibit (oxide, pinned-error table)
 *  - failed projection → the render failure panel
 * Paper never inverts with the theme (DIRECTION.md §4).
 */
@customElement('mnx-document-viewer')
export class DocumentViewer extends LitElement {
  @property({ type: Boolean }) unrolled = false;
  @consume({ context: mnxDocumentContext, subscribe: true })
  @property({ attribute: false })
  mnxDoc!: MnxDocument | null;

  @consume({ context: playbackStateContext, subscribe: true })
  @property({ attribute: false })
  playbackState!: PlaybackState;

  @consume({ context: selectionContext, subscribe: true })
  @property({ attribute: false })
  selection!: SelectionContext;

  /**
   * Which projection to draw — `auto` (default), `notation`, `tab`, `both`.
   *
   * `auto` is NOT a synonym for `notation`: unset means *defer to the layer
   * below*, so it resolves the document's own `_x.mnxLab.tab.staffKind`
   * (docs/core-viewer-surface.md, the precedence chain). That is what makes a
   * bare `<mnx-document-viewer>` plus a document show the AUTHOR's intended view
   * with no host JavaScript — the read-only player's whole story. A host that
   * names a view outranks the document, always: the hint is a hint.
   */
  @property({ type: String, reflect: true }) view: ViewSetting = 'auto';
  /**
   * Staff in canonical staff spaces. `1sp` is the historical 100% request and
   * resolves through the engine's shared affine ink line, so line spacing,
   * glyphs, text and stems scale together. Clamped 0.4–4sp.
   *
   * **`null` (the default) means FITTED, not 1.** Unset defers downward, per
   * the precedence chain: with no `pxPerSp` the renderers fit a short score up
   * to fill the viewport, and pinning it to 1 would silently switch that off
   * for every host that never asked. A number pins the scale; `render-scale`
   * reports what any given paint actually used.
   *
   * This prop used to size the paper CARD and never reached the engine —
   * core-render-density-zoom.md called that out as the wrong wiring. It had no
   * consumers anywhere in the repo, so it was repurposed rather than joined by
   * a second knob meaning the same thing.
   */
  @property({ type: Number }) zoom: number | null = null;
  // `hasTab` was evicted (docs/core-viewer-surface.md): the element never read
  // it, so it was pure host homework — and hosts did it badly, string-searching
  // the document JSON. `view="auto"` derives the same fact from the document.
  /**
   * Viewer-supplied instrument: overrides the document's `_x.mnxLab.strings`
   * / `capo` for rendering (presentation only — never written back). Without
   * either source, no instrument is assumed and tab staves don't render.
   * The flat pair applies to EVERY part — right for single-instrument
   * documents, wrong for ensembles (it clobbers parts that declared their
   * own strings and hands the rest an instrument they never asked for).
   */
  @property({ attribute: false }) stringsOverride: MnxTuningEntry[] | null = null;
  @property({ type: Number }) capoOverride: number | null = null;
  /**
   * Per-part instrument overrides (roadmap/inprogress/core-score-hud.md),
   * keyed by part `id` when the part has one, else by its index as a string.
   * Mirrors the shape of the declaration it stands in for — `_x.mnxLab`
   * strings/capo live on the part. Per part it wins over the flat pair
   * above, which remains the fallback for parts without an entry.
   */
  @property({ attribute: false }) partTabSetups: Record<string, TabSetup> | null = null;
  // invalidByDesign / pinnedErrors / errorPointer were EVICTED
  // (docs/core-viewer-surface.md, stage 3): the spec-gap exhibit is workbench
  // chrome that rode on the element as three props an embed could never want.
  // The workbench renders it and skips this element entirely.
  /** Embed trim: tighter paper margins. */
  @property({ type: Boolean, reflect: true }) compact = false;
  /**
   * Colour scheme for the score: `auto` (default), `light`, or `dark`.
   *
   * `auto` needs no host cooperation and is not a guess: `color-scheme` is an
   * inherited CSS property, so the component simply resolves `light-dark()`
   * against whatever scheme the host page is using — its own declared
   * `color-scheme`, or the reader's OS preference when the page says
   * `light dark`. A page that never opts into dark stays light, which is the
   * right answer: the paper should match the page it sits on, not the OS.
   *
   * What auto CANNOT see is a host's private convention (a `.dark` class,
   * `data-theme="night"`) — nothing in CSS exposes that — which is exactly
   * why this explicit override exists.
   */
  @property({ type: String, reflect: true }) theme: 'auto' | 'light' | 'dark' = 'auto';
  /**
   * Features to hide, comma-separated: `hide="lyrics,badges"`
   * (docs/core-viewer-surface.md — ONE set-valued knob, not N booleans).
   *
   * Each member is sorted by one question: does hiding it reclaim SPACE?
   * `lyrics` reserve a vertical band, so hiding them is a layout concern and
   * travels to the engine, where the system closes up. `badges` are drawn in
   * the margin and reclaim nothing, so they are hidden in this stylesheet.
   * Same attribute either way — the host should not have to know which kind a
   * feature is, and the split is what stops CSS from being asked to do
   * layout's job.
   */
  @property({ type: String, reflect: true }) hide = '';
  /**
   * Part indices (in the document) to leave off the score — a reader's choice,
   * like `hide`, never a document field. The layout draws a copy without them
   * whose notes keep their whole-document keys, so playback paint and seeking
   * still address the right ink (src/model/partVisibility.ts). Hiding every
   * part is ignored.
   */
  @property({ attribute: false }) hiddenParts: readonly number[] = [];
  private visible: { doc: MnxStructure; key: string; result: VisibleParts } | null = null;
  private visibleParts(): VisibleParts {
    const doc = this.mnxDoc!.mnxJson;
    const key = [...this.hiddenParts].sort((a, b) => a - b).join(',');
    if (this.visible?.doc !== doc || this.visible.key !== key)
      this.visible = { doc, key, result: withHiddenParts(doc, this.hiddenParts) };
    return this.visible.result;
  }
  @property({ type: String, attribute: 'lyrics', reflect: true }) lyrics: DisplayOptions['lyrics'] = 'all';
  @property({ type: String, attribute: 'time-signatures', reflect: true }) timeSignatures: DisplayOptions['timeSignatures'] = 'show';
  @property({ type: String, attribute: 'clefs', reflect: true }) clefs: DisplayOptions['clefs'] = 'show';
  @property({ type: String, attribute: 'score-title', reflect: true }) scoreTitle: DisplayOptions['title'] = 'show';
  @property({ type: String, attribute: 'bar-numbers', reflect: true }) barNumbers: DisplayOptions['barNumbers'] = undefined;
  @property({ type: String, attribute: 'instrument-names', reflect: true }) instrumentNames: DisplayOptions['instrumentNames'] = undefined;
  @property({ type: String, attribute: 'beams', reflect: true }) beams: DisplayOptions['beams'] = undefined;
  @property({ type: String, attribute: 'selected-verse', reflect: true }) selectedVerse: DisplayOptions['selectedVerse'] = undefined;

  /** Legacy host override. Unset: Staff owns vertical gaps, Space horizontal air. */
  @property({ type: Number, reflect: true }) clearance: number | undefined = undefined;

  private effectiveDisplay(): DisplayOptions {
    return normalizeDisplayOptions({
      lyrics: this.lyrics, timeSignatures: this.timeSignatures, clefs: this.clefs,
      title: this.scoreTitle, barNumbers: this.barNumbers,
      clearance: this.clearance, instrumentNames: this.instrumentNames, beams: this.beams, selectedVerse: this.selectedVerse
    }, this.hiddenFeatures());
  }

  /**
   * Horizontal density — `normal` (default), `compact`, `spacious`
   * (roadmap/complete/core-render-density-zoom.md): how much music fits on a
   * line, WITHOUT shrinking the glyphs. Zoom changes how big the notes are;
   * density changes how much horizontal air sits between and around them. Vertical gaps stay
   * proportional to Staff; the axes compose freely.
   *
   * A preset, not a slider, because the element is a binding: the engine takes
   * a length in staff spaces, and these are the three values worth naming. `density-h`
   * could accept a number later without breaking anyone — presets resolve to
   * numbers, so the vocabulary widens rather than changes.
   */
  @property({ type: String, reflect: true }) density: DensityPreset = 'normal';
  /**
   * The numeric form of the same axis — `density-h="1.4"`, in staff spaces. When set it wins
   * over `density`; unset (the default) the preset decides.
   *
   * The preset doc above reserved exactly this: *"`density-h` could accept a
   * number later without breaking anyone — presets resolve to numbers, so the
   * vocabulary widens rather than changes."* A continuous control
   * (core-zoom-density-pad.md) is what needed it. A number is Space in staff
   * spaces (core-space-units-sp.md), clamped by the engine's own `clampSpace`,
   * so a host and the pad get the same floor — which is zero.
   */
  @property({ attribute: 'spacing-mode' }) spacingMode: 'natural' | 'fill' = 'fill';

  @property({ type: Number, attribute: 'density-h' }) densityH: number | null = null;
  /** Legacy whitespace multiplier. Explicit values override Clearance wholesale;
   * unset uses Staff/Space unless a host explicitly supplies Clearance. */
  @property({ type: Number, attribute: 'density-pad' }) densityPad: number | null = null;
  /**
   * The selection overlay is showing where the cursor WAS, but keystrokes
   * are going somewhere else (core-editor-focus-scope.md, stage 3): a
   * cursor drawn at full strength while the keyboard belongs to another
   * element claims input it will not receive. Presentation only — the host
   * decides the policy and the element just renders it dimmed. Once the
   * editor mount promotes to `elements/` and the listener sits on this host,
   * this becomes derivable here from :focus-within.
   */
  @property({ type: Boolean, reflect: true, attribute: 'selection-inactive' })
  selectionInactive = false;

  /**
   * Opt OUT of the touch gestures (roadmap/inprogress/core-touch-gestures.md).
   *
   * Default-on, because a score you cannot zoom on a phone is the defect and a
   * host should not have to know the feature exists to get it. The escape hatch
   * is here for a host that owns these gestures itself — an embed inside a
   * page-level pan/zoom surface, where two recognisers would fight.
   */
  @property({ type: Boolean, reflect: true, attribute: 'no-gestures' })
  noGestures = false;

  /**
   * Whether a pointer may place the edit cursor
   * (roadmap/complete/core-editor-pointer-placement.md). OFF by default and
   * turned on by `bindEditor`, so a viewer with no editor — the embed, the
   * player-only piece page, a read-only score — emits no `position-selected`
   * and draws no hover ghost. Placement is a capability the host grants, not
   * something the score does on its own.
   */
  @property({ type: Boolean, attribute: 'pointer-placement' })
  pointerPlacement = false;

  /** The measured page, rebuilt on demand after each paint. */
  private pointerMap: ScorePointerMap | null = null;
  /** Rendered staves in system order — built while painting, where the model is in scope. */
  private staffTable: RenderedStaff[] = [];
  /** The hover ghost's last landing, so an unchanged hover redraws nothing. */
  private hoverSignature = '';
  private hoverQueued = false;

  @query('#projection-container')
  container!: HTMLElement;

  @state() private renderErrors: { pane: string; message: string }[] = [];

  /** The gesture readout, while a drag is showing one. */
  @state() private gestureHud: string | null = null;

  private gestures: ScoreGestures | null = null;
  /**
   * A zoom gesture is in flight. Its paints take the fast path: the score is
   * re-engraved every frame (a gesture you cannot see is unusable), but the
   * selection enclosure, its tween, the anchor event and the reveal scroll —
   * measured at a third of a zoomed paint on Kind Hearted Woman, all of it
   * `getBBox`/`getBoundingClientRect` forcing layout on a 7,000-node SVG —
   * wait for the release, which repaints once with everything.
   */
  private gesturing = false;
  /** A fast-path paint happened, so the release owes a full one. */
  private gesturePainted = false;
  /** The square layout across the gesture (`render/layoutCache.ts`); fresh
   *  each gesture, so nothing stale can outlive one. */
  private layoutCache = createLayoutCache();

  /**
   * The layout worker (`layout.worker.ts`), for the length of a gesture.
   *
   * Built on the first gesture and kept; never required. While a gesture is
   * active a paint becomes a plan REQUEST: the worker lays out, the reply is
   * emitted here, and requests coalesce to latest-wins — one in flight, at
   * most one waiting, and the waiting one is always the newest. A paint on
   * the main thread (the release, or anything else that repaints) bumps the
   * epoch, so a reply from before it is dropped rather than drawn over it.
   */
  private worker: Worker | null = null;
  private workerFailed = false;
  private workerBusy = false;
  private workerPending: PlanRequest | null = null;
  private planSeq = 0;
  private planEpoch = 0;
  /** What each request was resolved at, for the reply's bookkeeping. */
  private planMeta = new Map<number, { densityH: number }>();
  /** The engraving entries for the document on screen. Memoised so their
   *  identity holds from one paint to the next, which is what lets the
   *  layout cache above hit; recomputed the moment the document or the
   *  unrolling changes. */
  private entriesMemo: { mnx: MnxStructure; unrolled: boolean; entries: ReturnType<typeof engravingEntries> } | null = null;

  private entriesFor(mnx: MnxStructure): ReturnType<typeof engravingEntries> {
    const memo = this.entriesMemo;
    if (memo && memo.mnx === mnx && memo.unrolled === this.unrolled) return memo.entries;
    const entries = engravingEntries(mnx, this.unrolled);
    this.entriesMemo = { mnx, unrolled: this.unrolled, entries };
    return entries;
  }

  private resizeHandler = () => this.renderProjection();

  /**
   * Re-lay-out when the CONTAINER's width changes, not just the window's.
   *
   * The window listener above cannot see the shell folding its rail or its
   * side panel away: the viewport never moves, so the score kept its old line
   * width and the reader's new room stayed empty until they happened to
   * resize something. Same for an embed host animating its own layout.
   *
   * Width only, and compared against the width actually rendered at, because
   * the observer also fires on the HEIGHT changes this render causes — a
   * taller engraving, a scrollbar appearing — and re-rendering on those is
   * how a resize observer turns into a loop.
   */
  private containerObserver: ResizeObserver | null = null;
  private renderedWidth = 0;
  /** Layout identity of the selected recording's pre/post-roll regions. */
  private renderedBookends = '';

  /** One-shot re-render when the Bravura font file finishes loading: the
   *  enclosure overlay measures glyph boxes, and a first paint that races the
   *  font would freeze fallback-font geometry into the highlight. */
  private fontRedrawQueued = false;
  /** A rung morph survives the renderer replacing its SVG by snapshotting the
   * old geometry first. A new paint cancels the old frame loop and begins
   * from the transition's current shape, so fast Escape/Enter presses do not
   * snap backward. */
  private cancelEnclosureTween: (() => void) | null = null;

  /** The last successful paint's system packing, and the density ladder
   *  derived from it — keyed on the packing's identity, so a new paint
   *  invalidates it and repeated `densitySteps()` calls do not re-pack. */
  private lastPackings: PackingInput[] | null = null;
  private ladder: { of: PackingInput[]; steps: number[] } | null = null;
  /** The density that packing was laid out at — `systemRows()`'s input. */
  private lastDensityH = 1;
  /** The Staff value the last paint actually used, in ENGINE space (before the
   *  pane's shrink). A gesture must continue from what is on screen, and while
   *  `zoom` is null — fitted — this is the only answer to what that is. Not the
   *  shrunk figure `render-scale` reports: the drag moves the `zoom` property,
   *  which is the engine's request, and feeding back the post-shrink number
   *  would make every drag fight the fit. */
  private lastStaffSp = 1;

  static styles = [
    // The viewer carries its own tokens (core-viewer-embedded-app.md): on a
    // host page there is no app ancestor to inherit them from, and without
    // them the paper is transparent, the ink is the host's, and the staff
    // lines are not drawn at all.
    viewerTokens,
    sharedChrome,
    scrollbars,
    css`
      :host {
        display: block;
        height: 100%;
        overflow: auto;
        /* Horizontal padding is whitespace Space owns (core-space-units-sp.md):
           the paint sets --mnx-space-paper from the Space policy, 0 at Space 0
           so the first barline meets the pane, 1 at and above the default.
           Vertical padding is Staff's and does not move. */
        padding: 5px calc(5px * var(--mnx-space-paper, 1));
        min-width: 0;
        background: var(--bg);
        /* pan-y, not none: the browser keeps one-finger vertical scrolling —
           which on a score is most of what a reader does — and the gesture
           layer claims the second tap of a double-tap-drag by preventDefault on
           a non-passive touchstart (gestures.ts). Taking none here would mean
           hand-writing pan, momentum and rubber-banding, over the whole page in
           studio, where the score IS the page. */
        touch-action: pan-y;
        /* A mouse double-click-drag selects text by word, which is exactly the
           gesture's shape. */
        user-select: none;
        -webkit-user-select: none;
      }

      /* The explicit theme override. Declaring color-scheme is the whole
         mechanism: light-dark() resolves against the USED scheme, so pinning
         it here re-resolves every token below in one stroke. The auto value
         declares nothing on purpose — that is what lets the inherited value
         (the host page's choice, else the reader's preference) through. */
      :host([theme='light']) {
        color-scheme: light;
      }

      :host([theme='dark']) {
        color-scheme: dark;
      }

      /* Keyboard ownership, made visible (core-editor-focus-scope.md).
         :focus-within, not :focus — a popover input inside the component
         still means the keyboard is ours, and the ring must not blink off
         mid-typing. Outline rather than border: no reflow, and it draws
         outside the box so the paper's geometry is untouched. Click focus
         counts on purpose — for an editor, a click really does transfer key
         ownership. */
      :host(:focus-within) {
        outline: 2px solid var(--focus-ring);
        outline-offset: -2px;
      }

      /* The host is the focus target; its own ring is the signal above. */
      :host(:focus) {
        outline-color: var(--focus-ring);
      }

      /* The paper FILLS the space it is given, and the engine lays the music
         out to whatever width that is — a wider window is more bars per
         system, which is the whole point of a screen-first engraver.
         It used to be capped at min(100%, 820px), a page-shaped constant
         that left a fold of empty bench either side once the rail folded
         away: the reader had made room for music and got margin.
         --mnx-paper-width is the escape hatch for a host that wants the page
         look back (--mnx-paper-width: 820px); max-width keeps any value
         honest against the container. */
      .paper {
        width: var(--mnx-paper-width, 100%);
        max-width: 100%;
        box-sizing: border-box;
        background: var(--paper);
        color: var(--paper-ink);
        border-radius: var(--radius-panel);
        box-shadow: var(--shadow);
        border: 1px solid oklch(0.85 0.01 85 / 0.6);
        padding: 30px calc(26px * var(--mnx-space-paper, 1));
        margin: 0 auto;
        transition: width 0.15s ease;
      }

      :host([compact]) .paper {
        padding: 16px calc(14px * var(--mnx-space-paper, 1));
        border-radius: var(--radius-control);
      }

      .document-heading {
        /* Centred over the page, engraving-style, and pulled up into the
           paper's padding so the title reads from the top margin rather than
           floating a full pad below it. The pull is FIXED px against the
           paper's fixed padding — scaled with the heading it would swallow
           the whole pad at high staff scales and touch the paper's edge. */
        margin: -14px 0 calc(var(--mnx-document-heading-size, 18px) * 1.333);
        text-align: center;
        color: var(--paper-ink);
        font-family: var(--sans);
        font-size: var(--mnx-document-heading-size, 18px);
        font-weight: 700;
        line-height: 1.15;
        letter-spacing: -0.02em;
        overflow-wrap: anywhere;
      }

      .document-artist {
        font-weight: 400;
      }

      .document-separator {
        color: var(--ink-3);
        font-weight: 400;
      }

      :host([compact]) .document-heading {
        /* The compact paper's pad is 16px, so the pull shrinks with it. */
        margin-top: -8px;
        margin-bottom: calc(var(--mnx-document-heading-size, 18px) * 0.9);
      }

      /* Honor the engine's intrinsic size — fitPxPerSp already fills the
         width up to FIT_MAX_PX_PER_SP; stretching past it would defeat the
         cap and turn one-bar scenarios into posters. */
      #projection-container svg {
        display: block;
        max-width: 100%;
        height: auto;
        margin: 0 auto;
        pointer-events: auto;
        color: var(--paper-ink);
      }

      #projection-container svg .staff-line {
        stroke: var(--paper-line);
      }

      #projection-container svg .notehead {
        cursor: pointer;
        transition: fill 0.12s;
      }

      /* Selection/active recolor to the accent — overrides the engine's
         presentation attributes (CSS wins over attributes). */
      #projection-container svg .notehead.selected,
      #projection-container svg .notehead.active,
      #projection-container svg .accidental.selected,
      #projection-container svg .accidental.active {
        fill: var(--accent) !important;
      }

      #projection-container svg .fret-number {
        cursor: pointer;
      }

      #projection-container svg .fret-number.selected,
      #projection-container svg .fret-number.active {
        fill: var(--accent) !important;
      }

      /* Both view: one model selection, two renderings. The projection that
         owns the input dialect stays full strength; the other remains visible
         as an echo. From part-measure upward the enclosure is one merged rect,
         so no child carries this class and the asymmetry resolves itself. */
      #projection-container svg .selected.selection-echo,
      #projection-container svg .enclosure rect.selection-echo {
        opacity: 0.4;
      }

      /* The selection-ladder enclosure (enclosure.ts): one vocabulary, fill
         fading and border firming as the level widens — cell → slice → beads
         → panel → panel-wide → frame. Behind the ink, never clickable. */
      #projection-container svg .enclosure {
        pointer-events: none;
      }

      #projection-container svg .enclosure rect {
        fill: var(--accent);
        stroke: var(--accent);
      }

      /* The section rung's label chip (workbench-rung-legibility.md). Bar and
         section share the panel-wide shape, and the bar's slot already covers
         the strip the label sits in, so extent cannot separate them — in a
         one-bar section the two shapes are identical. The chip is the channel
         that does not degenerate: it reads considerably stronger than the
         0.06 wash beneath it, and sits under the ink so the name it lights
         stays legible. */
      #projection-container svg .enclosure-label {
        pointer-events: none;
      }

      #projection-container svg .enclosure-label rect {
        fill: var(--accent);
        fill-opacity: 0.22;
        stroke: var(--accent);
        stroke-opacity: 0.7;
      }

      /* The scope PREVIEW: the same shapes, drawn as a candidate — no fill,
         a dashed border. It must read as "this is what widening would take",
         never as a second selection, so it takes the accent's outline and
         none of its weight. */
      #projection-container svg .enclosure-preview {
        pointer-events: none;
      }

      #projection-container svg .enclosure-preview rect {
        fill: none;
        stroke: var(--accent);
        stroke-opacity: 0.85;
        stroke-dasharray: 4 3;
      }

      #projection-container svg .enc-cell rect {
        fill-opacity: 0.16;
        stroke-opacity: 0.9;
      }

      #projection-container svg .enc-slice rect {
        fill-opacity: 0.13;
        stroke-opacity: 0.6;
      }

      #projection-container svg .enc-lasso rect,
      #projection-container svg .enc-run rect {
        fill-opacity: 0.13;
        stroke-opacity: 0.55;
      }

      #projection-container svg .enc-panel rect {
        fill-opacity: 0.09;
        stroke-opacity: 0.45;
      }

      #projection-container svg .enc-panel-wide rect {
        fill-opacity: 0.06;
        stroke-opacity: 0.5;
      }

      #projection-container svg .enc-frame rect {
        fill-opacity: 0;
        stroke-opacity: 0.75;
      }

      /* The cursor's ghost cell: hollow, dashed — a place for a thing. */
      #projection-container svg .cursor-ghost {
        pointer-events: none;
      }

      #projection-container svg .cursor-ghost rect {
        fill: none;
        stroke: var(--accent);
        stroke-opacity: 0.8;
      }

      #projection-container svg .cursor-ghost .pending-fret-bg {
        stroke: var(--accent);
        stroke-opacity: 0.45;
      }

      #projection-container svg .cursor-ghost .pending-fret {
        fill: var(--accent);
      }

      /* Keyboard elsewhere (core-editor-focus-scope.md): fade the selection
         vocabulary — enclosure, ghost cell, and the accent recolor — so the
         overlay reads as "where you were", not "where your next keystroke
         lands". Faded, not hidden: losing the place entirely makes refocus
         disorienting, and the point is to stop the CLAIM, not the memory. */
      /* The hover ghost (pointerHitTest.ts): where a click WOULD put the
         cursor. The cursor ghost's own shape and colour, at half its
         presence — the same object proposed rather than placed. Fainter than
         the dimmed cursor, so the two are never confused when both show. */
      :host #projection-container svg .pointer-ghost { pointer-events: none; }
      :host #projection-container svg .pointer-ghost rect {
        fill: none;
        stroke: var(--accent);
        stroke-opacity: 0.4;
      }
      :host([selection-inactive]) #projection-container svg .pointer-ghost,
      :host([selection-inactive]) #projection-container svg .enclosure,
      :host([selection-inactive]) #projection-container svg .cursor-ghost {
        opacity: 0.3;
      }

      :host([selection-inactive]) #projection-container svg .notehead.selected,
      :host([selection-inactive]) #projection-container svg .accidental.selected,
      :host([selection-inactive]) #projection-container svg .fret-number.selected {
        fill: color-mix(in oklab, var(--accent), var(--paper-ink) 65%) !important;
      }

      :host #projection-container svg .unperformed { opacity: 0.3; cursor: default; }
      :host #projection-container svg .recording-bookend-block {
        fill: color-mix(in oklab, var(--paper-ink) 7%, var(--paper));
        stroke: color-mix(in oklab, var(--paper-ink) 22%, transparent);
        stroke-width: 1px;
        transition: fill 0.12s ease, stroke 0.12s ease;
      }
      :host #projection-container svg .recording-bookend-label {
        fill: var(--ink-3);
        pointer-events: none;
      }
      :host #projection-container svg .recording-bookend.active.recording-bookend-block {
        fill: color-mix(in oklab, var(--playback) 18%, var(--paper));
        stroke: color-mix(in oklab, var(--playback) 62%, transparent);
      }
      :host #projection-container svg .recording-bookend.active.recording-bookend-label {
        fill: var(--paper-ink);
        font-weight: 700;
      }
      /* Playback ink (render/playbackInk.ts): one colour per voice, cycled
         past four — the tokens are in tokens.ts (--playback, --playback-2…4);
         voice 1 is the original blue, so a single-voice part looks as it
         always did. Hosts override with --mnx-playback, --mnx-playback-2 … -4. */
      :host #projection-container svg [data-source-id].playback-ink,
      :host([selection-inactive]) #projection-container svg [data-source-id].playback-ink {
        fill: var(--playback-voice) !important;
      }
      :host #projection-container svg [data-playback-voice="2"].playback-ink { --playback-voice: var(--playback-2); }
      :host #projection-container svg [data-playback-voice="3"].playback-ink { --playback-voice: var(--playback-3); }
      :host #projection-container svg [data-playback-voice="4"].playback-ink { --playback-voice: var(--playback-4); }
      /* The digit's paper mask is the lamp, not the digit: stretched to the
         note's release by the paint, tinted with the voice colour, the digit
         above it in full colour. The tint is a mix with the paper, and it is
         STRONGER on dark paper: a 22% mix reads as a clear pill on white but
         sinks into the dark ground, so dark takes 40% (reviewed 2026-09-13).
         The untinted mask would have hidden the digit — both carried the
         note's id and both went blue. */
      :host #projection-container svg [data-source-id].fret-bg.playback-ink,
      :host([selection-inactive]) #projection-container svg [data-source-id].fret-bg.playback-ink {
        fill: light-dark(
          color-mix(in oklab, var(--playback-voice) 22%, var(--paper, oklch(0.985 0.006 85))),
          color-mix(in oklab, var(--playback-voice) 40%, var(--paper, oklch(0.235 0.008 80)))
        ) !important;
        rx: 3px;
      }

      /* THE TAB STAFF'S REST PILL. Tab draws no rest, so a reader following
         a performance on the fingerboard has nothing to follow through one —
         and a blank staff is also what held notes look like. The layout puts
         an invisible pill on the centre band spanning the rest's duration
         (layout/tabStaff.ts); it appears only under the playhead, hollow, so
         it reads as "the beat is here and nothing is fretted" rather than as
         a note. Dashed, because a rest is a silence and the sounding mark is
         a solid tinted pill — the shapes must not be confused at a glance. */
      :host #projection-container svg .tab-rest-pill { display: none; }
      :host #projection-container svg .tab-rest-pill.playback-ink,
      :host([selection-inactive]) #projection-container svg .tab-rest-pill.playback-ink {
        display: inline;
        fill: none !important;
        stroke: var(--playback-voice);
        stroke-width: 1.25px;
        stroke-dasharray: 3 2.5;
        opacity: 0.85;
      }

      /* Emit-side hide (docs/core-viewer-surface.md): diagnostic badges sit
         in the margin and reclaim no space, so CSS is the honest tool. A
         layout-side feature must never be hidden this way — it would leave a
         gap where the content used to be. */
      :host([data-hide-badges]) #projection-container svg .diagnostic-marker {
        display: none;
      }

      /* The tab fret knock-out must match the paper, not the app bg. */
      #projection-container svg .fret-bg {
        fill: var(--paper) !important;
      }

      .no-doc {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 200px;
        color: var(--paper-line);
        font-size: 13px;
      }

      /* The gesture readout. It exists because the CONTROL does not: the zoom
         pad prints these numbers on screen, and on touch there is no pad — an
         invisible continuous control with no feedback is unlearnable. Fixed to
         the viewport rather than the scroller, because which element scrolls
         differs between the two shells. */
      .gesture-hud {
        position: fixed;
        left: 50%;
        /* Near the top, not the bottom: the bottom edge is where both shells
           keep their playback grip, and where the hand that is zooming
           usually is. Large enough to read at arm's length on a tablet. */
        top: 72px;
        transform: translateX(-50%);
        z-index: 2;
        padding: 10px 16px;
        border-radius: var(--radius-control);
        background: var(--surface);
        border: 1px solid var(--ink);
        color: var(--ink);
        font-family: var(--sans);
        font-size: 15px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 2px 4px var(--shadow-far), 0 12px 30px var(--shadow-far);
      }

      /* Zoom mode, on the paper itself: a ring around the score for as long
         as a gesture is armed or in flight. The readout alone was missed on a
         tablet — it is small, at the edge, and under the hand. */
      :host([data-zooming]) #projection-container {
        outline: 3px solid var(--ink);
        outline-offset: 2px;
        border-radius: var(--radius-hair);
      }

      /* ── state panels (on paper — warm fixed colors, never themed) ── */
      .state-panel {
        max-width: 60ch;
        margin: 8px auto;
        padding: 8px 4px;
      }

      .state-panel h3 {
        display: flex;
        align-items: center;
        gap: 9px;
        font-family: var(--sans);
        font-size: 17px;
        font-weight: 500;
        margin: 0 0 8px;
      }

      .state-panel .sp-dia {
        width: 10px;
        height: 10px;
        background: oklch(0.55 0.125 42);
        transform: rotate(45deg);
        border-radius: var(--radius-hair);
        flex-shrink: 0;
      }

      .state-panel .sp-warn {
        width: 10px;
        height: 10px;
        background: oklch(0.66 0.105 78);
        border-radius: 50%;
        flex-shrink: 0;
      }

      .state-panel p {
        font-size: 12.5px;
        line-height: 1.6;
        color: oklch(0.4 0.012 80);
        margin: 0 0 10px;
        text-wrap: pretty;
      }

      .err-table {
        border: 1px solid oklch(0.85 0.02 60);
        border-radius: var(--radius-control);
        overflow: hidden;
        margin-top: 12px;
      }

      .err-row {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 10px 14px;
        background: oklch(0.97 0.012 60);
        cursor: pointer;
        width: 100%;
        text-align: left;
      }

      .err-row:hover {
        background: oklch(0.95 0.018 60);
      }

      .err-row .er-rule {
        font-family: var(--mono);
        font-size: 11px;
        font-weight: 600;
        color: oklch(0.55 0.125 42);
      }

      .err-row .er-msg {
        font-size: 12px;
        color: oklch(0.38 0.012 80);
      }

      .err-row .er-path {
        font-family: var(--mono);
        font-size: 10px;
        color: oklch(0.55 0.012 80);
      }

      .fail-code {
        font-family: var(--mono);
        font-size: 11px;
        color: oklch(0.55 0.125 42);
        background: oklch(0.96 0.01 60);
        border: 1px solid oklch(0.88 0.015 60);
        border-radius: var(--radius-tab);
        padding: 9px 12px;
        margin-top: 8px;
        display: block;
      }
    `
  ];

  connectedCallback() {
    super.connectedCallback();
    // Focusable by default (core-editor-focus-scope.md): a custom element
    // cannot be document.activeElement without a tabindex, so "the keyboard
    // is ours while focus is inside us" is not even expressible until this
    // exists. A host page may override — tabindex="-1" for click-only focus,
    // or its own order — so an author-set value is never clobbered.
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
    window.addEventListener('resize', this.resizeHandler);
    this.addEventListener('scroll', this.onAnchorScroll);
    this.addEventListener('keydown', this.onTransportKey);
    this.addEventListener('keyup', this.onTransportKeyup);
    this.syncGestures();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.boundContainer?.removeEventListener('pointerdown', this.onPointerPlace);
    this.boundContainer?.removeEventListener('pointermove', this.onPointerHover);
    this.boundContainer?.removeEventListener('pointerleave', this.onPointerLeave);
    this.boundContainer = null;
    window.removeEventListener('resize', this.resizeHandler);
    this.removeEventListener('scroll', this.onAnchorScroll);
    this.removeEventListener('keydown', this.onTransportKey);
    this.removeEventListener('keyup', this.onTransportKeyup);
    this.containerObserver?.disconnect();
    this.containerObserver = null;
    this.cancelEnclosureTween?.();
    this.cancelEnclosureTween = null;
    this.gestures?.detach();
    this.gestures = null;
    this.worker?.terminate();
    this.worker = null;
    this.workerBusy = false;
    this.workerPending = null;
  }

  /** Attach or drop the recogniser to match `no-gestures`. Called from
   *  `connectedCallback` and again on the property, because a property BINDING
   *  (`.noGestures=${…}`) is not guaranteed to have landed by the time the
   *  element connects — only an attribute is. */
  private syncGestures() {
    const want = this.isConnected && !this.noGestures;
    if (want && !this.gestures) {
      this.gestures = new ScoreGestures(this, this.gestureTargets());
      this.gestures.attach();
    } else if (!want && this.gestures) {
      this.gestures.detach();
      this.gestures = null;
    }
  }

  private gestureTargets(): GestureTargets {
    return {
      // Resolved, never null: a drag continues from what is on screen. On a
      // fitted score that is the last paint's scale, not 1.
      effective: () => ({
        staffSp: this.zoom ?? this.lastStaffSp,
        densityH: this.densityH ?? DENSITY_H[this.density] ?? SPACE_DEFAULT_SP
      }),
      // `natural` spacing has no ladder to walk — the same rule the pad
      // follows, so a gesture and a click agree on what a step is.
      ladder: () => (this.spacingMode === 'natural' ? null : this.densitySteps()),
      commit: next => {
        if (next.staffSp !== null) this.zoom = next.staffSp;
        if (next.densityH !== null) this.densityH = next.densityH;
        this.announceZoom();
      },
      reset: () => {
        // Match the pad's product defaults.
        this.zoom = DEFAULT_STAFF_SP;
        this.densityH = DEFAULT_SPACE_SP;
        this.announceZoom();
      },
      toggleTransport: () =>
        this.dispatchEvent(
          new CustomEvent('transport-toggle', { bubbles: true, composed: true })
        ),
      hud: text => {
        this.gestureHud = text;
      },
      active: on => {
        if (on === this.gesturing) return;
        this.gesturing = on;
        if (on) {
          this.layoutCache = createLayoutCache();
          this.startPlanGesture();
        }
        // The attribute is what the paper's outline keys on: the mode has to
        // be visible on the score itself, not only in a readout at the edge.
        this.toggleAttribute('data-zooming', on);
        if (on || !this.gesturePainted) return;
        this.gesturePainted = false;
        // The release paint draws the chrome the gesture skipped. It does NOT
        // reveal: the reader just placed the score with a finger, and a scroll
        // to the selection would undo exactly that.
        this.followQueued = false;
        this.renderProjection();
      }
    };
  }

  /**
   * The element applies the gesture to ITSELF and then says so.
   *
   * Both halves are load-bearing. Applying locally is what makes a bare
   * `<mnx-document-viewer>` — the embed face, studio — zoomable with no host
   * JavaScript at all. Announcing is what keeps a host that owns this state
   * (the workbench, where `<mnx-zoom-pad>` holds it) from overwriting the
   * gesture on its next render. The detail is shaped exactly like the pad's
   * `ZoomPadChange`, so the workbench binds the handler it already had.
   */
  private announceZoom() {
    this.dispatchEvent(
      new CustomEvent('zoom-change', {
        detail: { staffSp: this.zoom, staffScale: this.zoom, densityH: this.densityH },
        bubbles: true,
        composed: true
      })
    );
  }

  /**
   * The score container is bound HERE and not in `firstUpdated`, because it
   * does not necessarily exist then: with no document the element renders a
   * "No document loaded" panel and no `#projection-container` at all. A host
   * that loads its document asynchronously — studio, which fetches the piece —
   * therefore first-updates with nothing to bind to, and a one-shot attach in
   * `firstUpdated` silently did nothing and never tried again. The workbench
   * has its scenario at first render, which is why it never showed this.
   *
   * Two things were lost that way in studio: pointer placement (a click on the
   * score did nothing at all) and the resize observer (the score never
   * re-engraved when the pane changed width). Both are re-bound whenever the
   * container appears, changes identity, or goes away.
   */
  private boundContainer: HTMLElement | null = null;
  private bindScoreSurface() {
    const container = (this.container ?? null) as HTMLElement | null;
    if (container === this.boundContainer) return;
    if (this.boundContainer) {
      this.boundContainer.removeEventListener('pointerdown', this.onPointerPlace);
      this.boundContainer.removeEventListener('pointermove', this.onPointerHover);
      this.boundContainer.removeEventListener('pointerleave', this.onPointerLeave);
    }
    this.containerObserver?.disconnect();
    this.containerObserver = null;
    this.boundContainer = container;
    if (!container) return;
    // Placement listens on the CONTAINER, not the host: the pointer must be
    // over the paper, and nothing else is bound here, so the gesture layer on
    // the host is untouched.
    container.addEventListener('pointerdown', this.onPointerPlace);
    container.addEventListener('pointermove', this.onPointerHover);
    container.addEventListener('pointerleave', this.onPointerLeave);
    if (typeof ResizeObserver === 'undefined') return;
    this.containerObserver = new ResizeObserver(() => {
      const width = container.getBoundingClientRect().width;
      // Sub-pixel jitter is not a new line width; ignore it rather than
      // re-engraving the score on a rounding difference.
      if (Math.abs(width - this.renderedWidth) < 1) return;
      this.renderProjection();
    });
    this.containerObserver.observe(container);
  }

  firstUpdated() {
    this.bindScoreSurface();
  }

  updated(changed: Map<string | number | symbol, unknown>) {
    // The container may have just appeared (the first document) or gone (a
    // host clearing it), so the surface is re-bound before anything reads it.
    this.bindScoreSurface();
    if(changed.has('playbackState')){
      if(this.bookendSignature()!==this.renderedBookends)this.renderProjection();
      else {this.paintPlayback();this.paintBookends();}
      // Paused under a bound editor, the playhead IS the cursor
      // (core-single-cursor.md) and the selection's own reveal decides the
      // scroll; following the playhead too would fight it.
      if(this.playbackState?.followPlayback && (this.playbackState.playing || !this.pointerPlacement))this.revealPlayback();
    }
    if (changed.has('noGestures')) this.syncGestures();
    this.toggleAttribute('data-hide-badges', this.hiddenFeatures().includes('badges'));
    if (
      changed.has('mnxDoc') ||
      changed.has('selection') ||
      changed.has('view') || changed.has('unrolled') ||
      changed.has('density') ||
      changed.has('densityH') ||
      changed.has('spacingMode') ||
      changed.has('densityPad') ||
      changed.has('clearance') ||
      changed.has('lyrics') ||
      changed.has('timeSignatures') ||
      changed.has('clefs') ||
      changed.has('scoreTitle') ||
      changed.has('barNumbers') ||
      changed.has('instrumentNames') ||
      changed.has('beams') ||
      changed.has('selectedVerse') ||
      changed.has('hide') ||
      changed.has('hiddenParts') ||
      changed.has('zoom') ||
      changed.has('stringsOverride') ||
      changed.has('capoOverride') ||
      changed.has('partTabSetups')
    ) {
      // A property moved: either the selection itself, or the layout under
      // it. Both are the reader acting on the score, so both earn a scroll.
      // The OTHER two callers of renderProjection — the resize observer and the
      // font-ready redraw — deliberately do not queue one: nobody asked for
      // them, and a repaint nobody asked for must not move the page.
      this.followQueued = true;
      this.renderProjection();
    }
  }

  renderProjection() {
    if (!this.container || !this.mnxDoc) return;

    // Embeds can reach here before the SMuFL metadata fetch resolves (the
    // full app usually renders after a user gesture). Defer one round trip.
    if (!isSmuflLoaded()) {
      loadSmufl().then(() => this.renderProjection());
      return;
    }

    // The gesture fast path — see `gesturing`.
    const quick = this.gesturing;
    if (quick) this.gesturePainted = true;
    if (quick && this.workerReady()) {
      this.requestPlan();
      return;
    }
    // A main-thread paint supersedes any plan in flight.
    this.planEpoch++;
    this.workerPending = null;

    const previousSvg = this.container.querySelector<SVGSVGElement>('svg');
    const previousEnclosure = previousSvg && !quick ? snapshotEnclosure(previousSvg) : null;
    this.cancelEnclosureTween?.();
    this.cancelEnclosureTween = null;

    const width = this.container.getBoundingClientRect().width || 600;
    // What this paint was laid out for — the observer's comparison point.
    this.renderedWidth = width;
    const failures: { pane: string; message: string }[] = [];
    const { visible, densityH, inputs, tabSetup } = this.paintInputs(width);
    // Whichever pane actually drew: `both` is one render, and in the split
    // views notation and tab derive the same factor from the shared plan, so
    // there is never a second, disagreeing answer to report.
    let outcome: RenderOutcome | null = null;

    const commonOpts = {
      ...inputs,
      mnx: visible.mnx,
      entries: this.entriesFor(visible.mnx),
      // Only across a gesture: the memo is keyed on identity and a gesture is
      // the one span in which the document provably does not change.
      cache: this.gesturing ? this.layoutCache : undefined,
      onNoteClick: this.onNoteClick
    };

    // A projection may fail on unsupported or invalid data, or on an engine bug.
    // Contain the failure without making an unverified schema-validity claim.
    const guarded = (target: HTMLElement, label: string, fn: () => void) => {
      try {
        fn();
      } catch (err) {
        target.innerHTML = '';
        failures.push({ pane: label, message: (err as Error).message });
      }
    };

    // The selection-ladder enclosure: drawn from the finished SVG's own
    // geometry, after the engine is done — the renderer never learns about
    // editor state, the overlay reads what it drew.
    //
    // The walk is done ONCE, into a table of the staves this paint draws, in
    // the order they go down a system — so the ordinal the enclosure speaks in
    // is just an index into it. The enclosure reads it forwards (address →
    // ordinal) and pointer placement reads it backwards (ordinal → address);
    // two separate walks would be two chances to disagree about a `both`-view
    // part whose tab staff is conditional.
    const resolved = this.resolvedView();
    const tabOnly = resolved === 'tab';
    const parts = visible.mnx.parts ?? [];
    const anyDeclaredKind = parts.some(part => {
      const kind = part._x?.mnxLab?.tab?.staffKind;
      return kind === 'both' || kind === 'tab';
    });
    const table: RenderedStaff[] = [];
    if (tabOnly) {
      // The tab-only view draws exactly one staff, for the first part.
      if (parts.length > 0)
        table.push({ partIndex: 0, staffIndex: 1, projection: 'tab', staffCount: 1 });
    } else {
      parts.forEach((part, at) => {
        const partIndex = visible.originalIndex[at];
        let staffCount = Math.max(1, part.staves ?? 1);
        for (const measure of part.measures) {
          for (const sequence of measure.sequences ?? []) {
            staffCount = Math.max(staffCount, sequence.staff ?? 1);
          }
        }
        for (let staffIndex = 1; staffIndex <= staffCount; staffIndex++)
          table.push({ partIndex, staffIndex, projection: 'notation', staffCount });
        if (resolved === 'both') {
          const kind = resolveTabSetup(tabSetup, part)?.staffKind ?? part._x?.mnxLab?.tab?.staffKind;
          const opted = kind === 'both' || kind === 'tab';
          const hasTab = (opted || !anyDeclaredKind) && tabPositionContext(part, tabSetup) !== null;
          if (hasTab) table.push({ partIndex, staffIndex: 1, projection: 'tab', staffCount });
        }
      });
    }
    this.staffTable = table;
    const renderedStaffOrdinals = (unit: NonNullable<SelectionContext['span']>['units'][number]) =>
      ordinalsOf(table, unit.partIndex, unit.staffIndex, tabOnly);

    const enclosed = (pane: HTMLElement, paint: RenderOutcome) => {
      const kind = this.selection?.enclosure;
      const svg = pane.querySelector('svg');
      const primaryProjection = this.resolvedView() === 'both'
        ? this.selection?.primaryProjection
        : null;
      if (svg) markProjectionEchoes(svg, primaryProjection);
      // The candidate scope, when the host is previewing one: its own dashed
      // layer, drawn from note ids because nothing in the render is tagged
      // for it (the selection has not moved).
      const preview = this.selection?.preview;
      if (preview && svg && !quick) {
        drawEnclosure(svg, preview.enclosure, {
          preview: true,
          entries: commonOpts.entries,
          noteIds: preview.noteIds,
          primaryProjection
        });
      } else if (svg) {
        svg.querySelector(':scope > g.enclosure-preview')?.remove();
      }
      if (kind && svg && !quick) {
        drawEnclosure(svg, kind, {
          entries: commonOpts.entries,
          noteIds: this.selection?.selectedNoteIds,
          eventIds: this.selection?.selectedEventIds,
          span: this.selection?.span,
          systemRows: packedRowMeasures(paint.packings, densityH),
          staffOrdinals: renderedStaffOrdinals,
          primaryProjection,
          litLabels: this.selection?.litLabels === true
        });
        let cancellation: (() => void) | null = null;
        cancellation = tweenEnclosure(svg, previousEnclosure, () => {
          if (this.cancelEnclosureTween === cancellation) this.cancelEnclosureTween = null;
          this.emitSelectionAnchor();
        });
        this.cancelEnclosureTween = cancellation;
        // The ghost cell: the cursor's own cell when empty. A measureless part
        // is the one structural exception — it receives a panel-shaped vacancy
        // because a note cannot exist until the first bar does.
        const ghost = this.selection?.cursor;
        if ((kind === 'cell' || ghost?.structuralEmpty || ghost?.pendingFret != null) && ghost) {
          drawCursorGhost(svg, ghost, {
            systemRows: packedRowMeasures(paint.packings, densityH),
            staffOrdinals: renderedStaffOrdinals
          });
        }
        if (!this.fontRedrawQueued && !document.fonts.check('4px Bravura')) {
          this.fontRedrawQueued = true;
          void document.fonts.ready.then(() => this.renderProjection());
        }
      }
    };

    // No pane captions: the view is named by whichever surface hosts this
    // element (the workbench's tabs, an embed host's chrome) — a label inside
    // the paper spent engraving space restating it.
    this.container.innerHTML = '';
    const resolvedView = this.resolvedView();
    if (resolvedView === 'tab') {
      const pane = this.appendPane();
      guarded(pane, 'tab', () => {
        outcome = renderMnxToSvgTab({ container: pane, ...commonOpts, tabSetup });
        enclosed(pane, outcome);
      });
    } else if (resolvedView === 'notation') {
      const pane = this.appendPane();
      guarded(pane, 'notation', () => {
        outcome = renderMnxToSvgNotation({ container: pane, ...commonOpts });
        enclosed(pane, outcome);
      });
    } else {
      // One composed system — notation staff over tab staff in a single SVG
      // with joined barlines (src/engine/layout/bothSystem.ts), not two
      // stacked renders.
      const pane = this.appendPane();
      guarded(pane, 'both', () => {
        outcome = renderMnxToSvgBoth({ container: pane, ...commonOpts, tabSetup });
        enclosed(pane, outcome);
      });
    }

    // Only update state when it changed, to avoid a render loop.
    if (JSON.stringify(failures) !== JSON.stringify(this.renderErrors)) {
      this.renderErrors = failures;
    }

    // `render-scale`: what this paint actually used. A host cannot print an
    // honest zoom readout without it — `fitted` scales with the viewport, so
    // the number moves on resize with nobody touching a control. Skipped when
    // the layout threw: there is no scale to report, and the last good value
    // is a better thing for a readout to keep showing than a fabricated 1sp.
    // Cast, not annotation: every assignment above happens inside a callback,
    // so control-flow analysis has narrowed `outcome` to `never` by here.
    this.finishPaint(outcome as RenderOutcome | null, densityH);

    this.renderedBookends = this.bookendSignature();
    this.paintPlayback();
    this.paintBookends();
    if (quick) return;
    // WHO OWNS THE SCROLL. A moving playhead does: while the transport runs,
    // a paint chases it and the selection waits. A PARKED one does not, and
    // that is the whole of this condition — `followPlayback` is true by
    // default and stays true with the transport stopped, so gating on it alone
    // meant every paint re-revealed a playhead that had not moved and the
    // selection was never followed at all. Keyboard navigation could not
    // scroll the score: End walked to the last bar off screen and stayed there.
    const chasing = this.playbackState?.playing === true
      && this.playbackState.followPlayback && this.playbackState.ordinal !== null;
    if (chasing) this.revealPlayback();
    this.emitSelectionAnchor();
    if (this.followQueued) {
      this.followQueued = false;
      if (!chasing) this.revealSelection();
    }
  }

  /**
   * The measured page, built lazily after each paint and kept until the next
   * one. A hover asks this on every frame it moves, so the reads behind it
   * happen once, not per event.
   */
  private measuredPage(): { svg: SVGSVGElement; map: ScorePointerMap } | null {
    const svg = this.container?.querySelector<SVGSVGElement>('svg');
    const rows = this.systemRows();
    if (!svg || !rows) return null;
    if (!this.pointerMap)
      this.pointerMap = buildPointerMap(svg, rows, this.staffTable, unitsPerSp(svg));
    return { svg, map: this.pointerMap };
  }

  /** A point in the page's own coordinates, or null off-screen geometry. */
  private scorePointOf(event: PointerEvent | MouseEvent, svg: SVGSVGElement) {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  /** The note under a pointer, when there is one — the same ink the click
   *  path already resolves, unwrapped from its occurrence in an unrolled view. */
  private noteKeyUnder(event: Event): string | undefined {
    const target = event.target;
    if (!(target instanceof Element)) return undefined;
    // A NOTE, not merely something with a name. Rests, stems and beams all
    // carry their event's id, and this field means "the pointer was on a
    // notehead" to everything that reads it: the session takes the slot's own
    // line and voice from it, and the playback host stands down from its own
    // seek because a note press seeks through `note-selected` instead.
    //
    // A rest never does — it is not in the layout's activation index, so the
    // click bridge drops it — and naming one here made the press fall between
    // the two: no note seek, and no bar seek either, because this said one had
    // happened. A rest is found through `columnKey` now, which is where ink
    // that is not a notehead belongs.
    const hit = target.closest<Element>('.notehead[data-source-id], .fret-number[data-source-id]');
    const raw = hit?.getAttribute('data-source-id');
    if (!raw) return undefined;
    const occurrence = this.unrolled ? parseOccurrenceKey(raw) : null;
    return occurrence ? occurrence.noteKey : raw;
  }

  /**
   * A press places the cursor (core-editor-pointer-placement.md). It is
   * emitted beside `note-selected`, never instead of it: a press on a note
   * still seeks playback, and now also moves the cursor, which is how the two
   * positions stay together until the reader presses play.
   *
   * **`pointerdown`, not `click`** — and not as a preference. Selecting a note
   * can re-engrave the score (a press in the combined view switches which
   * rendering owns spatial input, which repaints), so the element under the
   * pointer is *gone* by the time the mouse-up arrives: down and up land on
   * different nodes and the browser synthesises no `click` at all. Measured in
   * a real browser, 2026-09-20. `engine/render/svg.ts` already selects on the
   * press for its own reasons and says so; this is the same rule, met from the
   * other side.
   */
  private readonly onPointerPlace = (event: PointerEvent) => {
    if (!this.pointerPlacement || this.gesturing) return;
    // The primary button only: a right-click opens a menu, and a second
    // finger belongs to the gesture layer.
    if (event.button !== 0 || !event.isPrimary) return;
    const page = this.measuredPage();
    if (!page) return;
    const point = this.scorePointOf(event, page.svg);
    const hit = point && hitTest(page.map, point, this.noteKeyUnder(event));
    if (!hit) return;
    // Unrolled, the ink names its visit (`w2:…`): the press means THAT visit.
    const visit = this.unrolled && event.target instanceof Element
      ? parseOccurrenceKey(event.target.closest('[data-source-id]')?.getAttribute('data-source-id') ?? '')?.ordinal
      : undefined;
    const placement: PointerPlacement = visit === undefined ? hit : { ...hit, ordinal: visit };
    drawPointerGhost(page.svg, page.map, null);
    this.hoverSignature = '';
    this.dispatchEvent(
      new CustomEvent<PointerPlacement>('position-selected', {
        detail: placement,
        bubbles: true,
        composed: true
      })
    );
  };

  /**
   * The hover ghost: where a click would land. Mouse only — touch has no
   * hover, and the snap is what makes a tap self-evident there instead.
   *
   * Coalesced to one frame and skipped when the landing has not changed, so
   * moving the mouse across a bar costs one redraw per cell, not per pixel.
   */
  private readonly onPointerHover = (event: PointerEvent) => {
    if (!this.pointerPlacement || event.pointerType !== 'mouse' || this.gesturing) return;
    if (this.hoverQueued) return;
    this.hoverQueued = true;
    const { clientX, clientY, target } = event;
    requestAnimationFrame(() => {
      this.hoverQueued = false;
      if (!this.pointerPlacement || this.gesturing) return;
      const page = this.measuredPage();
      if (!page) return;
      const point = this.scorePointOf(
        { clientX, clientY } as MouseEvent,
        page.svg
      );
      const placement =
        point &&
        hitTest(
          page.map,
          point,
          target instanceof Element ? this.noteKeyUnder({ target } as unknown as Event) : undefined
        );
      // Keyed by where the ghost will be DRAWN, so a mouse sliding across one
      // beat's neighbourhood redraws nothing: the column is the landing when
      // there is one, and the fraction only where there is no ink to measure.
      const signature = placement
        ? `${placement.measureIndex}:${placement.partIndex}:${placement.staffIndex}:${placement.projection}:${placement.line}:` +
          (placement.columnKey ?? placement.fraction.toFixed(3))
        : '';
      if (signature === this.hoverSignature) return;
      this.hoverSignature = signature;
      drawPointerGhost(page.svg, page.map, placement ?? null);
    });
  };

  private readonly onPointerLeave = () => {
    const svg = this.container?.querySelector<SVGSVGElement>('svg');
    if (svg) svg.querySelector(':scope > g.pointer-ghost')?.remove();
    this.hoverSignature = '';
  };

  /** The click that becomes a selection — shared by every emit path. */
  private readonly onNoteClick = (
    noteId: string,
    measureIdx: number,
    noteIdx: number,
    projection: RenderedProjection
  ) => {
    const occurrence = this.unrolled ? parseOccurrenceKey(noteId) : null;
    if (occurrence) noteId = occurrence.noteKey;
    this.dispatchEvent(
      new CustomEvent('note-selected', {
        detail: { noteId, measureIdx, noteIdx, projection, ...(occurrence ? { ordinal: occurrence.ordinal } : {}) },
        bubbles: true,
        composed: true
      })
    );
  };

  /**
   * Everything a paint needs besides the document, resolved once per paint.
   * Shared by the main-thread render and the worker request, which is why
   * `inputs` is DATA — no callbacks, no entries, no cache — and why the tab
   * setup comes back both resolved (for here) and as its parts (for there).
   */
  private paintInputs(width: number) {
    const visible = this.visibleParts();
    const staffSp = clampStaffSp(this.zoom);
    // Resolved once and remembered with the packing: `systemRows()` has to
    // re-pack at the value THIS paint used, not at whatever the properties say
    // when it is asked.
    const densityH = this.densityH ?? DENSITY_H[this.density] ?? SPACE_DEFAULT_SP;
    // Preserve absence so the engine can choose Clearance or the legacy override.
    const densityPad = this.densityPad ?? undefined;
    const inputs: PlanInputs = {
      width,
      activeNoteIds: [], // Playback is a paint overlay, independent of layout and selection.
      durationSpans: true, // …but it stretches fret masks to the release the layout records.
      selectedNoteIds: this.selection?.selectedNoteIds ?? [],
      selectedEventIds: this.selection?.selectedEventIds ?? [],
      // Layout-side hides reach the engine so their space is reclaimed —
      // every view honors them (the tab layout draws lyrics too).
      display: this.effectiveDisplay(),
      hide: this.hiddenFeatures(),
      // The preset resolves to the engine's multiplier here — the element
      // binds a behavior it does not implement (docs/core-viewer-surface.md).
      // A numeric `density-h` outranks the preset; unset, the preset decides.
      spacingMode: this.spacingMode,
      densityH,
      densityPad,
      // Always undefined — the horizontal axis FITS, at every zoom level
      // (core-zoom-density-pad.md, ruling 2). `zoom` used to arrive here as a
      // pinned pxPerSp, which is exactly what coupled it to the horizontal
      // axis: pinning changed `widthSp`, the plan re-packed, and the notes
      // slid sideways under a control that claims to be vertical. It now
      // travels as `staffSp` and touches nothing but the ink, so zooming
      // and resizing stay separate events.
      pxPerSp: undefined,
      // null stays null: unset means FITTED, and a fitted paint is square.
      staffSp: staffSp ?? undefined,
      systemBookends: this.systemBookends()
    };

    const flatSetup: TabSetup | undefined =
      this.stringsOverride || this.capoOverride !== null
        ? {
            ...(this.stringsOverride ? { strings: this.stringsOverride } : {}),
            ...(this.capoOverride !== null ? { capo: this.capoOverride } : {})
          }
        : undefined;
    // Per-part overrides resolve by part id, then index; a part without an
    // entry falls back to the flat pair (which applies to every part).
    const perPart = this.partTabSetups;
    const tabSetup: PartTabSetups | undefined = perPart
      ? (part: MnxPart) => {
          // Index overrides name the part's place in the WHOLE document.
          const at = visible.mnx.parts.indexOf(part);
          return (
            (part.id !== undefined ? perPart[part.id] : undefined) ??
            perPart[String(at < 0 ? at : visible.originalIndex[at])] ??
            flatSetup
          );
        }
      : flatSetup;
    return { visible, densityH, inputs, flatSetup, perPart, tabSetup };
  }

  /**
   * What every paint reports once it has drawn: the packing for
   * `densitySteps()`, the heading size, and `render-scale`. A host cannot
   * print an honest zoom readout without the last — `fitted` scales with the
   * viewport, so the number moves on resize with nobody touching a control.
   * Skipped when the layout threw: there is no scale to report, and the last
   * good value is a better thing for a readout to keep showing than a
   * fabricated 1sp.
   */
  private finishPaint(drawn: RenderOutcome | null, densityH: number) {
    if (!drawn) return;
    const { pxPerSp, staffSp: used, fitted } = drawn;
    // The packing rides along on the same paint, for `densitySteps()`. It is
    // NOT in the event: the detail stays exactly `RenderScale`, because a
    // host wants the answer ("which values do something?"), not the input.
    this.lastPackings = drawn.packings;
    this.lastDensityH = densityH;
    this.lastStaffSp = used;
    // The page was rebuilt, so every measurement taken off it is stale —
    // including the hover ghost, which was drawn into the SVG that just went.
    this.pointerMap = null;
    this.hoverSignature = '';
    // The paper's horizontal padding follows Space with the engraving it
    // frames — set with the paint so the two never disagree for a frame.
    this.style.setProperty('--mnx-space-paper', String(spacePolicy(densityH).paperPad));
    const shrink = this.shrinkToPane();
    // A section label is 1.8sp in the SVG. The heading lives in ordinary
    // DOM above it, so give it the same em converted through the EXACT
    // on-screen vertical scale (including max-width's final shrink).
    this.style.setProperty(
      '--mnx-document-heading-size',
      `${SCORE_LABEL_SIZE_SP * pxPerSp * shrink}px`
    );
    this.dispatchEvent(
      new CustomEvent<RenderScale>('render-scale', {
        detail: renderScale(pxPerSp * shrink, fitted),
        bubbles: true,
        composed: true
      })
    );
  }

  // ── the layout worker, for the length of a gesture ──────────────────────

  /** The worker, built on first use; false when it cannot be, for good. */
  private workerReady(): boolean {
    if (this.workerFailed) return false;
    if (this.worker) return true;
    if (typeof Worker === 'undefined') {
      this.workerFailed = true;
      return false;
    }
    const smufl = getSmuflData();
    if (!smufl) return false;
    try {
      // Written out literally: the bundler finds workers by this exact shape.
      const worker = new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<LayoutReply>) => this.onWorkerReply(event.data);
      worker.onerror = () => {
        this.abandonWorker();
        if (this.gesturing) this.renderProjection();
      };
      worker.postMessage({ type: 'smufl', ...smufl } satisfies LayoutRequest);
      this.worker = worker;
      return true;
    } catch {
      this.workerFailed = true;
      return false;
    }
  }

  /** The gesture's document, posted once so every request can refer to it —
   *  and so its identity holds in the worker for the square-layout memo. */
  private startPlanGesture() {
    if (!this.mnxDoc || !this.workerReady()) return;
    const visible = this.visibleParts();
    this.planEpoch++;
    this.worker!.postMessage({
      type: 'doc',
      mnx: visible.mnx,
      originalIndex: visible.originalIndex
    } satisfies LayoutRequest);
  }

  /** A paint as a request. Latest wins: one in flight, one waiting at most. */
  private requestPlan() {
    const width = this.container.getBoundingClientRect().width || 600;
    this.renderedWidth = width;
    const { densityH, inputs, flatSetup, perPart } = this.paintInputs(width);
    const request: PlanRequest = {
      type: 'plan',
      seq: ++this.planSeq,
      epoch: this.planEpoch,
      view: this.resolvedView(),
      unrolled: this.unrolled,
      inputs,
      flatSetup,
      perPart
    };
    this.planMeta.set(request.seq, { densityH });
    if (this.workerBusy) {
      if (this.workerPending) this.planMeta.delete(this.workerPending.seq);
      this.workerPending = request;
      return;
    }
    this.workerBusy = true;
    this.worker!.postMessage(request);
  }

  private onWorkerReply(reply: LayoutReply) {
    this.workerBusy = false;
    const meta = this.planMeta.get(reply.seq);
    this.planMeta.delete(reply.seq);
    // Start the waiting request before drawing this one, so the worker lays
    // out the next step while the main thread emits this one.
    const next = this.workerPending;
    if (next && this.worker) {
      this.workerPending = null;
      this.workerBusy = true;
      this.worker.postMessage(next);
    }
    // Superseded by a main-thread paint, or by a newer gesture.
    if (reply.epoch !== this.planEpoch || !meta) return;
    if (reply.type === 'error') {
      // The main thread reports layout failures as the honest state panel;
      // let it, and stop asking the worker.
      this.abandonWorker();
      this.renderProjection();
      return;
    }
    this.applyPlan(reply.plan, meta.densityH);
  }

  /** The emit half of a worker paint — what a gesture paint does on the main
   *  thread minus the layout, and minus the chrome the release owes. */
  private applyPlan(plan: RenderPlan, densityH: number) {
    if (!this.container) return;
    this.container.innerHTML = '';
    const pane = this.appendPane();
    let outcome: RenderOutcome | null = null;
    try {
      outcome = emitPlan(plan, pane, this.onNoteClick);
      const svg = pane.querySelector('svg');
      if (svg) {
        markProjectionEchoes(svg, this.resolvedView() === 'both' ? this.selection?.primaryProjection : null);
      }
      if (this.renderErrors.length) this.renderErrors = [];
    } catch (err) {
      pane.innerHTML = '';
      this.renderErrors = [{ pane: this.resolvedView(), message: (err as Error).message }];
    }
    this.finishPaint(outcome, densityH);
    this.paintPlayback();
  }

  private abandonWorker() {
    this.worker?.terminate();
    this.worker = null;
    this.workerFailed = true;
    this.workerBusy = false;
    this.workerPending = null;
    this.planMeta.clear();
  }

  /**
   * How much the PAGE shrank on its way to the screen — 1 when it did not.
   *
   * `#projection-container svg` carries `max-width: 100%`, so a drawing wider than
   * the pane is scaled down by the browser, both axes, before anybody sees it.
   * That is deliberate (the score fits the pane; nothing scrolls sideways),
   * but it means the engine's own answer stops being what is on screen exactly
   * where a reader most needs the truth: rigid columns are ink-priced, so a
   * large Staff value widens the drawing as well as heightening it, the shrink
   * grows with the ask, and the two nearly cancel. Measured 2026-08-21, tab
   * view in a 658px pane: asking 3.2sp draws 2.68sp, asking 6.4sp draws 2.97sp —
   * *"vertical spacing 320 doesn't seem half of 640"*, and it wasn't.
   *
   * So `render-scale` reports the scale the reader is looking at, and a
   * control can print a number that matches the staff in front of them. The
   * intrinsic width comes off the `width` attribute the emitter wrote, which
   * is the pre-CSS size by construction; the rect is post-CSS. Clamped at 1
   * because only shrinking is possible here (`max-width`, never `width`).
   */
  private shrinkToPane(): number {
    const svg = this.renderRoot.querySelector('#projection-container svg');
    if (!(svg instanceof SVGSVGElement)) return 1;
    const intrinsic = Number(svg.getAttribute('width'));
    const onScreen = svg.getBoundingClientRect().width;
    if (!(intrinsic > 0) || !(onScreen > 0)) return 1;
    return Math.min(1, onScreen / intrinsic);
  }

  /**
   * The density values that would actually change THIS score, as it is
   * currently drawn — ascending, from the engine's floor.
   *
   * A control stepping `density-h` by a fixed percentage spends most of its
   * clicks on values that engrave identically: inside the justifier's linear
   * range, tightening the springs and stretching them back are the same
   * operation (`spacing.ts`, `packingSignature`). Density only bites where it
   * moves a barline to another system. So the honest step is "the next value
   * that changes something", and only the layer that just laid the score out
   * can say which those are — it depends on the document, the viewport width
   * and Staff, all of which move.
   *
   * Null until a paint has succeeded. Recomputed per paint, cached in between:
   * a host may call this on every render of its own.
   */
  densitySteps(): number[] | null {
    const packings = this.lastPackings;
    if (!packings) return null;
    if (this.ladder?.of !== packings) {
      this.ladder = { of: packings, steps: densityLadder(packings) };
    }
    return this.ladder.steps;
  }

  /**
   * Which bars are on which system row, as measure indices — the score as the
   * reader sees it wrapped, top row first.
   *
   * Here for the same reason `densitySteps()` is: only the layer that just laid
   * the score out knows where the lines broke, and it depends on the viewport
   * width and Staff, both of which move. The selection ladder's
   * measure rung navigates systems with ↑↓, and `src/edit` may import only
   * `src/model`, so the mount asks this and hands the session an already
   * resolved `goToMeasure` — the stage-1 pattern, keeping the session
   * deterministic and its traces replayable.
   *
   * Null until a paint has succeeded.
   */
  systemRows(): number[][] | null {
    return this.lastPackings ? packedRowMeasures(this.lastPackings, this.lastDensityH) : null;
  }

  /** The selection's on-screen box: the enclosure overlay's bounding rect in
   *  viewport coordinates, or null while nothing is enclosed. The overlay is
   *  drawn from the finished SVG (enclosure.ts), so this is presentation
   *  geometry only — no editor vocabulary crosses the boundary
   *  (roadmap/inprogress/core-selection-tray-visuals.md). */
  selectionAnchorRect(): DOMRect | null {
    return this.enclosureRect(this.container?.querySelector<SVGGElement>('svg .enclosure') ?? null);
  }

  /** One enclosure group's box, narrowed to the system row the active measure
   *  is on. A bar-wide or frame rung is drawn as one fragment per row, and
   *  their union is a box spanning the whole page — true, and useless to
   *  anything planting itself on the selection. */
  private enclosureRect(enclosure: SVGGElement | null): DOMRect | null {
    if (!enclosure) return null;
    const activeMeasure = this.selection?.activeMeasureIndex;
    const rows = this.systemRows();
    const activeRow = activeMeasure === null || activeMeasure === undefined
      ? -1
      : (rows?.findIndex(row => row.includes(activeMeasure)) ?? -1);
    const pieces = activeRow >= 0
      ? [...enclosure.querySelectorAll<SVGRectElement>(`rect[data-system-row="${activeRow}"]`)]
      : [];
    if (pieces.length === 0) return enclosure.getBoundingClientRect();
    const boxes = pieces.map(piece => piece.getBoundingClientRect());
    const left = Math.min(...boxes.map(box => box.left));
    const top = Math.min(...boxes.map(box => box.top));
    const right = Math.max(...boxes.map(box => box.right));
    const bottom = Math.max(...boxes.map(box => box.bottom));
    return new DOMRect(left, top, right - left, bottom - top);
  }

  /** `selection-anchored`: fired after each render, and on the host's own
   *  scroll (the paper scrolls inside the host), so chrome planted on the
   *  selection — the command tray's shaft — can follow it. */
  private emitSelectionAnchor() {
    this.dispatchEvent(
      new CustomEvent('selection-anchored', {
        detail: { rect: this.selectionAnchorRect() },
        bubbles: true,
        composed: true
      })
    );
  }

  /** Context kept either side of a revealed selection, in client pixels —
   *  about a bar's worth of staff at the default scale, so what arrives is a
   *  selection in its music rather than a selection on an edge. */
  private static readonly REVEAL_PAD_PX = 32;

  /** Queued by a property-driven repaint, consumed by that paint. */
  private followQueued = false;

  /** Note key → 1-based voice (its sequence's index within the staff), built
   *  once per document: the paint runs every beat and must not walk the
   *  score each time. */
  private voiceByKey: { doc: MnxStructure; voices: Map<string, number> } | null = null;
  private playbackVoiceOf(noteKey: string): number {
    const doc = this.mnxDoc?.mnxJson;
    if (!doc) return 1;
    if (this.voiceByKey?.doc !== doc) {
      const voices = new Map<string, number>();
      forEachNoteAddress(doc, address => voices.set(address.key, address.voiceIndex + 1));
      // Rests are lit by the playhead too, and they are not notes — without
      // their keys here every rest would come back voice 1 and a second
      // voice's silence would light in the first voice's blue.
      for (const span of restSpansOf(doc)) voices.set(span.key, span.voiceIndex + 1);
      this.voiceByKey = { doc, voices };
    }
    return this.voiceByKey.voices.get(noteKey) ?? 1;
  }
  /** Follow the live ink without touching the selection or editor cursor. */
  private paintPlayback(){
    const sounding=new Map<string,number>();
    for(const w of this.playbackState?.highlight??[])
      sounding.set(occurrenceKey(w.noteKey,this.unrolled?w.ordinal:undefined),this.playbackVoiceOf(w.noteKey));
    if(this.container)paintPlaybackInk(this.container,sounding);
  }
  private systemBookends() {
    const durations = this.playbackState?.recordingBookends;
    if (!durations) return undefined;
    const label = (seconds: number) => {
      const rounded = Math.max(1, Math.round(seconds));
      return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
    };
    return {
      ...(durations.preRollSeconds > 0.001 ? { leading: {
        label: label(durations.preRollSeconds), title: `Pre-roll: ${label(durations.preRollSeconds)}`
      } } : {}),
      ...(durations.postRollSeconds > 0.001 ? { trailing: {
        label: label(durations.postRollSeconds), title: `Post-roll: ${label(durations.postRollSeconds)}`
      } } : {})
    };
  }
  private bookendSignature(): string { return JSON.stringify(this.systemBookends() ?? null); }
  private paintBookends() {
    const phase = this.playbackState?.mediaPhase;
    for (const node of this.container?.querySelectorAll<SVGElement>('.recording-bookend') ?? []) {
      const active = (phase === 'pre-roll' && node.classList.contains('recording-bookend-leading')) ||
        (phase === 'post-roll' && node.classList.contains('recording-bookend-trailing'));
      node.classList.toggle('active', active);
    }
  }
  private revealPlayback() {
    const occurrence=this.playbackState?.highlight[0];
    if(occurrence)this.revealOccurrence(occurrence);
  }
  /**
   * Where the playhead is drawn — the first sounding ink — or null when
   * nothing is lit. While the music plays the playhead IS the cursor
   * (core-single-cursor.md), so a label meant for the cursor hangs here.
   */
  playheadRect(): DOMRect | null {
    const occurrence=this.playbackState?.highlight[0];
    if(!occurrence)return null;
    const ink=[...(this.container?.querySelectorAll<SVGElement>('[data-source-id]')??[])]
      .find(node=>!node.classList.contains('unperformed') && node.getAttribute('data-source-id')===occurrenceKey(occurrence.noteKey,this.unrolled?occurrence.ordinal:undefined));
    return ink?.getBoundingClientRect() ?? null;
  }
  /** Public written-occurrence reveal. It never mutates selection or inspection. */
  revealOccurrence(occurrence: PlaybackOccurrence): boolean {
    const ink=[...(this.container?.querySelectorAll<SVGElement>('[data-source-id]')??[])]
      .find(node=>!node.classList.contains('unperformed') && node.getAttribute('data-source-id')===occurrenceKey(occurrence.noteKey,this.unrolled?occurrence.ordinal:undefined));
    if(!ink)return false;
    this.revealBox(ink.getBoundingClientRect(),'auto');return true;
  }
  private revealBox(box: DOMRect, behavior: ScrollBehavior) {
    const view=this.getBoundingClientRect();
    const top=revealScrollDelta({start:box.top,end:box.bottom},{start:view.top,end:view.bottom},DocumentViewer.REVEAL_PAD_PX);
    if(Math.abs(top)>=1)this.scrollBy({top,behavior});
  }

  /**
   * Bring the selection back into view, if it left.
   *
   * The SETTLED enclosure, not `selectionAnchorRect()`: mid-tween that
   * getter answers with the transition group, which starts at the geometry
   * the selection is leaving — following it would scroll to where the
   * selection just WAS. The tween's target group is already at its final
   * geometry (drawn, then hidden behind the morph), which is where the
   * reader is about to be looking.
   *
   * The cursor ghost is the fallback, not an afterthought: a cell the cursor
   * has moved to but nothing occupies draws no enclosure at all, and an empty
   * bar is somewhere a reader very much moves to on purpose.
   */
  private revealSelection() {
    const svg = this.container?.querySelector<SVGSVGElement>('svg');
    const settled =
      svg?.querySelector<SVGGElement>(':scope > g.enclosure:not(.enclosure-transition)') ??
      svg?.querySelector<SVGGElement>(':scope > g.cursor-ghost');
    const box = this.enclosureRect(settled ?? null);
    if (!box) return;
    this.revealBox(box,globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth');
  }

  /**
   * Space is play/pause at the score, the convention every notation package
   * keeps (MuseScore, Sibelius, Finale, Dorico, Guitar Pro all hold it) and the
   * reason `toggleNote` moved to `N`. The viewer does not know a player exists:
   * it reports the keystroke as the same `transport-toggle` the two-finger tap
   * emits, and the host decides what that means — with no player bound it is a
   * no-op, never an error.
   *
   * It overrides a focused button's own activation on purpose, exactly as the
   * player's tray does: after clicking a badge, Space means play, not "press
   * that again" (Enter still presses it). A text field keeps its space, and a
   * modified stroke is somebody else's.
   */
  private spaceIsTransport(event: KeyboardEvent) {
    return event.key === ' ' && !event.defaultPrevented && !event.isComposing
      && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey
      && !isTextEntry(event.composedPath()[0]);
  }

  private onTransportKey = (event: KeyboardEvent) => {
    if (!this.spaceIsTransport(event)) return;
    event.preventDefault();
    this.dispatchEvent(new CustomEvent('transport-toggle', { bubbles: true, composed: true }));
  };

  /** Chrome activates a focused button on Space's keydown being unprevented, Firefox on its keyup: both are taken. */
  private onTransportKeyup = (event: KeyboardEvent) => { if (this.spaceIsTransport(event)) event.preventDefault(); };

  private anchorScrollQueued = false;

  private onAnchorScroll = () => {
    if (this.anchorScrollQueued) return;
    this.anchorScrollQueued = true;
    requestAnimationFrame(() => {
      this.anchorScrollQueued = false;
      this.emitSelectionAnchor();
    });
  };

  /**
   * The precedence chain, resolved (docs/core-viewer-surface.md):
   * host attribute > document hint > built-in default.
   *
   * The fingerboard gate applies to every branch, not just `auto`: tab needs
   * KNOWN strings — declared by the part or supplied as a viewer override —
   * because no instrument is ever assumed. A document asking for tab without
   * strings, or a host asking for it, gets notation rather than an empty
   * fretboard drawn on a guess.
   */
  resolvedView(): ViewMode {
    const asked = this.view === 'auto' ? declaredStaffKind(this.mnxDoc?.mnxJson) : this.view;
    if (asked !== 'tab' && asked !== 'both') return 'notation';
    return this.tabCapable() ? asked : 'notation';
  }

  /** The views this document can draw — every one when strings are known,
   *  notation alone otherwise. Public (2026-09-12) for the score frame's staff
   *  control, which greys what it cannot offer rather than hiding it. */
  availableViews(): ViewMode[] {
    return this.tabCapable() ? ['notation', 'tab', 'both'] : ['notation'];
  }

  /** Are there strings to fret? Declared by a part, or supplied by the host's
   *  override — the two ways an instrument can become known. */
  private tabCapable(): boolean {
    const declared = (this.mnxDoc?.mnxJson.parts ?? []).some(
      part => (part._x?.mnxLab?.strings?.length ?? 0) > 0
    );
    const overridden =
      (this.stringsOverride?.length ?? 0) > 0 ||
      Object.values(this.partTabSetups ?? {}).some(setup => (setup.strings?.length ?? 0) > 0);
    return declared || overridden;
  }

  /** The `hide` attribute as a list. Unknown names are ignored rather than
   *  rejected: a host on an older artifact naming a newer feature should
   *  degrade to showing it, not to a broken render. */
  private hiddenFeatures(): readonly HideableFeature[] {
    return this.hide
      .split(',')
      .map(name => name.trim())
      .filter((name): name is HideableFeature => name === 'lyrics' || name === 'badges');
  }

  /** The piece's own identity, from `_x.mnxLab.work` in the document (MNX v27
   *  still has no standard field — w3c-cg/mnx#267). The wrapper's `name` is a
   *  host-owned fallback only: a scenario name, a filename, a library title. */
  private documentHeading(): { title: string; artist: string | null } {
    const clean = (value: string | undefined) => value?.trim() || null;
    const title =
      documentTitle(this.mnxDoc?.mnxJson) ?? clean(this.mnxDoc?.name) ?? clean(this.mnxDoc?.id);
    return {
      title: title ?? 'Untitled document',
      artist: documentArtist(this.mnxDoc?.mnxJson)
    };
  }

  private appendPane(): HTMLElement {
    const pane = document.createElement('div');
    this.container.appendChild(pane);
    return pane;
  }

  render() {
    // The paper's width is CSS now, not an inline style: it fills the
    // container and a host retunes it with `--mnx-paper-width`. It was never
    // dynamic — the same expression was pasted into both branches — and
    // `zoom` has not sized this card since core-zoom-density-pad.md ruling 3
    // sent it to the music inside instead.
    if (!this.mnxDoc) {
      return html`
        <div class="paper">
          <div class="no-doc">No document loaded</div>
        </div>
      `;
    }

    const heading = this.documentHeading();
    return html`
      <div class="paper" role="region" aria-label=${heading.title}>
        ${this.effectiveDisplay().title === 'hide' ? nothing : html`<h1 class="document-heading">
          ${heading.artist
            ? html`<span class="document-artist">${heading.artist}</span><span class="document-separator">: </span>`
            : nothing}<span class="document-title">${heading.title}</span>
        </h1>`}
        ${this.renderErrors.length
          ? html`
              <div class="state-panel">
                <h3><span class="sp-warn"></span>This view could not be rendered</h3>
                <p>
                  The layout failed while drawing this view. The details below identify the failure;
                  they do not establish whether the document is valid.
                </p>
                ${this.renderErrors.map(
                  f => html`<code class="fail-code">layout (${f.pane}): ${f.message}</code>`
                )}
              </div>
            `
          : nothing}
        <div id="projection-container"></div>
      </div>
      ${this.gestureHud
        ? html`<div class="gesture-hud" role="status">${this.gestureHud}</div>`
        : nothing}
    `;
  }

}
