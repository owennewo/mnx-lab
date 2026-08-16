import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  mnxDocumentContext,
  playbackStateContext,
  selectionContext
} from './mnxContext.ts';
import type { PlaybackState, SelectionContext } from './mnxContext.ts';
import { MnxDocument, MnxPart, MnxTuningEntry, declaredStaffKind } from '../model/mnx.ts';
import {
  resolveTabSetup,
  tabPositionContext,
  type PartTabSetups,
  type TabSetup
} from '../engine/tab/guitarPositions.ts';
import { renderMnxToSvgTab } from '../engine/tab/tabRenderer.ts';
import { renderMnxToSvgNotation } from '../engine/notation/notationRenderer.ts';
import { renderMnxToSvgBoth } from '../engine/both/bothRenderer.ts';
import { isSmuflLoaded, loadSmufl } from '../engine/smufl/smufl.ts';
import {
  clampStaffScale,
  type RenderOutcome,
  type RenderScale
} from '../engine/render/scale.ts';
import { densityLadder, packedRowMeasures, type PackingInput } from '../engine/layout/spacing.ts';
import { padDensityFor } from '../engine/layout/verticalDensity.ts';
import {
  drawCursorGhost,
  drawEnclosure,
  markProjectionEchoes,
  snapshotEnclosure,
  tweenEnclosure
} from './enclosure.ts';
import type { RenderedProjection } from '../engine/render/projection.ts';
// The view-mode axis belongs to the embeddable surface: the shell's toolbar
// imports it from here, never the other way around.
/** The projections the engine can draw. */
export type ViewMode = 'notation' | 'tab' | 'both';

/** What a host may ASK for: a projection, or `auto` — "defer to the document"
 *  (docs/core-viewer-surface.md). Unset is not a value; it is a deferral. */
export type ViewSetting = ViewMode | 'auto';

/** Named horizontal densities. The engine's knob is a multiplier; these are
 *  the three values worth a name (core-render-density-zoom.md). */
export type DensityPreset = 'compact' | 'normal' | 'spacious';

const DENSITY_H: Record<DensityPreset, number> = {
  compact: 0.65,
  normal: 1,
  spacious: 1.5
};
import { sharedChrome, scrollbars, viewerTokens } from './tokens.ts';
import type { HideableFeature } from '../engine/layout/notation.ts';

/**
 * The score area: a scrollable bench with a warm PAPER card at its centre.
 * The paper carries the engraved SVG (the rendering engine is a black box
 * here), or one of two honest state panels:
 *  - invalid-by-design → the spec-gap exhibit (oxide, pinned-error table)
 *  - valid-but-unrendered → the "validates, doesn't render yet" panel
 * Paper never inverts with the theme (DIRECTION.md §4).
 */
@customElement('mnx-score-viewer')
export class ScoreViewer extends LitElement {
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
   * bare `<mnx-score-viewer>` plus a document show the AUTHOR's intended view
   * with no host JavaScript — the read-only player's whole story. A host that
   * names a view outranks the document, always: the hint is a hint.
   */
  @property({ type: String, reflect: true }) view: ViewSetting = 'auto';
  /**
   * Staff scale — a multiplier on `pxPerSp`, so line spacing, glyphs, text and
   * stems all scale together (core-zoom-density-pad.md). Clamped 0.6–1.6.
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
   * Horizontal density — `normal` (default), `compact`, `spacious`
   * (roadmap/complete/core-render-density-zoom.md): how much music fits on a
   * line, WITHOUT shrinking the glyphs. Zoom changes how big the notes are;
   * density changes how much air sits between them, which is why they are
   * separate axes and compose freely.
   *
   * A preset, not a slider, because the element is a binding: the engine takes
   * a multiplier, and these are the three values worth naming. `density-h`
   * could accept a number later without breaking anyone — presets resolve to
   * numbers, so the vocabulary widens rather than changes.
   */
  @property({ type: String, reflect: true }) density: DensityPreset = 'normal';
  /**
   * The numeric form of the same axis — `density-h="0.82"`. When set it wins
   * over `density`; unset (the default) the preset decides.
   *
   * The preset doc above reserved exactly this: *"`density-h` could accept a
   * number later without breaking anyone — presets resolve to numbers, so the
   * vocabulary widens rather than changes."* A continuous control
   * (core-zoom-density-pad.md) is what needed it. Clamped by the engine's own
   * `clampDensity`, so a host and the pad get the same floor.
   */
  @property({ type: Number, attribute: 'density-h' }) densityH: number | null = null;
  /**
   * Vertical/frame density (roadmap/complete/core-vertical-density.md): a
   * multiplier on the whitespace a page RESERVES — the pads above and below
   * each system, and the margins either side — as opposed to `density-h`,
   * which spaces the music itself. Floored per row by the ink that row
   * actually holds, so tightening it can never put one system's stems through
   * the system above.
   *
   * **Unset is not 1.** Left alone it is DERIVED from the effective
   * `density-h` through `padDensityFor`, so a host that asks for tighter
   * spacing gets a tighter page rather than the same page with the music
   * squeezed inside it. That is the coupling core-vertical-density.md argued
   * for — one reader-facing intent over two engine scalars — and it lives
   * here, at the surface, precisely so it stays reversible: set this and it
   * wins, exactly like `density-h` over `density`.
   */
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

  @query('#score-container')
  container!: HTMLElement;

  @state() private renderErrors: { pane: string; message: string }[] = [];

  private resizeHandler = () => this.renderScore();

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
        padding: 5px;
        min-width: 0;
        background: var(--bg);
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
        padding: 30px 26px;
        margin: 0 auto;
        transition: width 0.15s ease;
      }

      :host([compact]) .paper {
        padding: 16px 14px;
        border-radius: var(--radius-control);
      }

      /* Honor the engine's intrinsic size — fitPxPerSp already fills the
         width up to FIT_MAX_PX_PER_SP; stretching past it would defeat the
         cap and turn one-bar scenarios into posters. */
      #score-container svg {
        display: block;
        max-width: 100%;
        height: auto;
        margin: 0 auto;
        pointer-events: auto;
        color: var(--paper-ink);
      }

      #score-container svg .staff-line {
        stroke: var(--paper-line);
      }

      #score-container svg .notehead {
        cursor: pointer;
        transition: fill 0.12s;
      }

      /* Selection/active recolor to the accent — overrides the engine's
         presentation attributes (CSS wins over attributes). */
      #score-container svg .notehead.selected,
      #score-container svg .notehead.active,
      #score-container svg .accidental.selected,
      #score-container svg .accidental.active {
        fill: var(--accent) !important;
      }

      #score-container svg .fret-number {
        cursor: pointer;
      }

      #score-container svg .fret-number.selected,
      #score-container svg .fret-number.active {
        fill: var(--accent) !important;
      }

      /* Both view: one model selection, two renderings. The projection that
         owns the input dialect stays full strength; the other remains visible
         as an echo. From part-measure upward the enclosure is one merged rect,
         so no child carries this class and the asymmetry resolves itself. */
      #score-container svg .selected.selection-echo,
      #score-container svg .enclosure rect.selection-echo {
        opacity: 0.4;
      }

      /* The selection-ladder enclosure (enclosure.ts): one vocabulary, fill
         fading and border firming as the level widens — cell → slice → beads
         → panel → panel-wide → frame. Behind the ink, never clickable. */
      #score-container svg .enclosure {
        pointer-events: none;
      }

      #score-container svg .enclosure rect {
        fill: var(--accent);
        stroke: var(--accent);
      }

      /* The scope PREVIEW: the same shapes, drawn as a candidate — no fill,
         a dashed border. It must read as "this is what widening would take",
         never as a second selection, so it takes the accent's outline and
         none of its weight. */
      #score-container svg .enclosure-preview {
        pointer-events: none;
      }

      #score-container svg .enclosure-preview rect {
        fill: none;
        stroke: var(--accent);
        stroke-opacity: 0.85;
        stroke-dasharray: 4 3;
      }

      #score-container svg .enc-cell rect {
        fill-opacity: 0.16;
        stroke-opacity: 0.9;
      }

      #score-container svg .enc-slice rect {
        fill-opacity: 0.13;
        stroke-opacity: 0.6;
      }

      #score-container svg .enc-lasso rect,
      #score-container svg .enc-run rect {
        fill-opacity: 0.13;
        stroke-opacity: 0.55;
      }

      #score-container svg .enc-panel rect {
        fill-opacity: 0.09;
        stroke-opacity: 0.45;
      }

      #score-container svg .enc-panel-wide rect {
        fill-opacity: 0.06;
        stroke-opacity: 0.5;
      }

      #score-container svg .enc-frame rect {
        fill-opacity: 0;
        stroke-opacity: 0.75;
      }

      /* The cursor's ghost cell: hollow, dashed — a place for a thing. */
      #score-container svg .cursor-ghost {
        pointer-events: none;
      }

      #score-container svg .cursor-ghost rect {
        fill: none;
        stroke: var(--accent);
        stroke-opacity: 0.8;
      }

      /* Keyboard elsewhere (core-editor-focus-scope.md): fade the selection
         vocabulary — enclosure, ghost cell, and the accent recolor — so the
         overlay reads as "where you were", not "where your next keystroke
         lands". Faded, not hidden: losing the place entirely makes refocus
         disorienting, and the point is to stop the CLAIM, not the memory. */
      :host([selection-inactive]) #score-container svg .enclosure,
      :host([selection-inactive]) #score-container svg .cursor-ghost {
        opacity: 0.3;
      }

      :host([selection-inactive]) #score-container svg .notehead.selected,
      :host([selection-inactive]) #score-container svg .accidental.selected,
      :host([selection-inactive]) #score-container svg .fret-number.selected {
        fill: color-mix(in oklab, var(--accent), var(--paper-ink) 65%) !important;
      }

      /* Emit-side hide (docs/core-viewer-surface.md): diagnostic badges sit
         in the margin and reclaim no space, so CSS is the honest tool. A
         layout-side feature must never be hidden this way — it would leave a
         gap where the content used to be. */
      :host([hide~='badges']) #score-container svg .diagnostic-marker {
        display: none;
      }

      /* The tab fret knock-out must match the paper, not the app bg. */
      #score-container svg .fret-bg {
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
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.resizeHandler);
    this.removeEventListener('scroll', this.onAnchorScroll);
    this.containerObserver?.disconnect();
    this.containerObserver = null;
    this.cancelEnclosureTween?.();
    this.cancelEnclosureTween = null;
  }

  firstUpdated() {
    if (!this.container || typeof ResizeObserver === 'undefined') return;
    this.containerObserver = new ResizeObserver(() => {
      const width = this.container.getBoundingClientRect().width;
      // Sub-pixel jitter is not a new line width; ignore it rather than
      // re-engraving the score on a rounding difference.
      if (Math.abs(width - this.renderedWidth) < 1) return;
      this.renderScore();
    });
    this.containerObserver.observe(this.container);
  }

  updated(changed: Map<string | number | symbol, unknown>) {
    if (
      changed.has('mnxDoc') ||
      changed.has('playbackState') ||
      changed.has('selection') ||
      changed.has('view') ||
      changed.has('density') ||
      changed.has('densityH') ||
      changed.has('densityPad') ||
      changed.has('hide') ||
      changed.has('zoom') ||
      changed.has('stringsOverride') ||
      changed.has('capoOverride') ||
      changed.has('partTabSetups')
    ) {
      this.renderScore();
    }
  }

  renderScore() {
    if (!this.container || !this.mnxDoc) return;

    // Embeds can reach here before the SMuFL metadata fetch resolves (the
    // full app usually renders after a user gesture). Defer one round trip.
    if (!isSmuflLoaded()) {
      loadSmufl().then(() => this.renderScore());
      return;
    }

    const previousSvg = this.container.querySelector<SVGSVGElement>('svg');
    const previousEnclosure = previousSvg ? snapshotEnclosure(previousSvg) : null;
    this.cancelEnclosureTween?.();
    this.cancelEnclosureTween = null;

    const width = this.container.getBoundingClientRect().width || 600;
    // What this paint was laid out for — the observer's comparison point.
    this.renderedWidth = width;
    const failures: { pane: string; message: string }[] = [];
    const staffScale = clampStaffScale(this.zoom);
    // Resolved once and remembered with the packing: `systemRows()` has to
    // re-pack at the value THIS paint used, not at whatever the properties say
    // when it is asked.
    const densityH = this.densityH ?? DENSITY_H[this.density] ?? 1;
    // Unset couples to the horizontal axis; explicit wins. Same precedence
    // shape as `density-h` over `density`, one level up.
    const densityPad = this.densityPad ?? padDensityFor(densityH);
    // Whichever pane actually drew: `both` is one render, and in the split
    // views notation and tab derive the same factor from the shared plan, so
    // there is never a second, disagreeing answer to report.
    let outcome: RenderOutcome | null = null;

    const onNoteClick = (
      noteId: string,
      measureIdx: number,
      noteIdx: number,
      projection: RenderedProjection
    ) => {
      this.dispatchEvent(
        new CustomEvent('note-selected', {
          detail: { noteId, measureIdx, noteIdx, projection },
          bubbles: true,
          composed: true
        })
      );
    };

    const commonOpts = {
      mnx: this.mnxDoc.mnxJson,
      width,
      activeNoteIds: this.playbackState?.activeNoteIds ?? [],
      selectedNoteIds: this.selection?.selectedNoteIds ?? [],
      onNoteClick,
      // Layout-side hides reach the engine so their space is reclaimed; the
      // tab renderer ignores what it has no concept of (lyrics).
      hide: this.hiddenFeatures(),
      // The preset resolves to the engine's multiplier here — the element
      // binds a behavior it does not implement (docs/core-viewer-surface.md).
      // A numeric `density-h` outranks the preset; unset, the preset decides.
      densityH,
      densityPad,
      // Always undefined — the horizontal axis FITS, at every zoom level
      // (core-zoom-density-pad.md, ruling 2). `zoom` used to arrive here as a
      // pinned pxPerSp, which is exactly what coupled it to the horizontal
      // axis: pinning changed `widthSp`, the plan re-packed, and the notes
      // slid sideways under a control that claims to be vertical. It now
      // travels as `staffScale` and touches nothing but the ink, so zooming
      // and resizing stay separate events.
      pxPerSp: undefined,
      // null stays null: unset means FITTED, and a fitted paint is square.
      staffScale: staffScale ?? undefined
    };

    // The layout engine throws on documents using features it doesn't support
    // yet — that's the honest "validates, doesn't render" state, not a crash.
    const guarded = (target: HTMLElement, label: string, fn: () => void) => {
      try {
        fn();
      } catch (err) {
        target.innerHTML = '';
        failures.push({ pane: label, message: (err as Error).message });
      }
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
          const parts = this.mnxDoc?.mnxJson.parts ?? [];
          return (
            (part.id !== undefined ? perPart[part.id] : undefined) ??
            perPart[String(parts.indexOf(part))] ??
            flatSetup
          );
        }
      : flatSetup;

    // The selection-ladder enclosure: drawn from the finished SVG's own
    // geometry, after the engine is done — the renderer never learns about
    // editor state, the overlay reads what it drew.
    const renderedStaffOrdinals = (unit: NonNullable<SelectionContext['span']>['units'][number]) => {
      if (unit.partIndex === undefined || unit.staffIndex === undefined) return [];
      const parts = this.mnxDoc?.mnxJson.parts ?? [];
      const resolved = this.resolvedView();
      if (resolved === 'tab') return unit.partIndex === 0 ? [0] : [];
      const anyDeclaredKind = parts.some(part => {
        const kind = part._x?.mnxLab?.tab?.staffKind;
        return kind === 'both' || kind === 'tab';
      });
      let ordinal = 0;
      const found: number[] = [];
      parts.forEach((part, partIndex) => {
        let staffCount = Math.max(1, part.staves ?? 1);
        for (const measure of part.measures) {
          for (const sequence of measure.sequences ?? []) {
            staffCount = Math.max(staffCount, sequence.staff ?? 1);
          }
        }
        if (partIndex === unit.partIndex) {
          found.push(ordinal + Math.max(0, Math.min(staffCount - 1, unit.staffIndex! - 1)));
        }
        ordinal += staffCount;
        if (resolved === 'both') {
          const kind = resolveTabSetup(tabSetup, part)?.staffKind ?? part._x?.mnxLab?.tab?.staffKind;
          const opted = kind === 'both' || kind === 'tab';
          const hasTab = (opted || !anyDeclaredKind) && tabPositionContext(part, tabSetup) !== null;
          if (hasTab) {
            if (partIndex === unit.partIndex && unit.staffIndex === 1) found.push(ordinal);
            ordinal++;
          }
        }
      });
      return found;
    };

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
      if (preview && svg) {
        drawEnclosure(svg, preview.enclosure, {
          preview: true,
          noteIds: preview.noteIds,
          primaryProjection
        });
      } else if (svg) {
        svg.querySelector(':scope > g.enclosure-preview')?.remove();
      }
      if (kind && svg) {
        drawEnclosure(svg, kind, {
          noteIds: this.selection?.selectedNoteIds,
          span: this.selection?.span,
          systemRows: packedRowMeasures(paint.packings, densityH),
          staffOrdinals: renderedStaffOrdinals,
          primaryProjection
        });
        let cancellation: (() => void) | null = null;
        cancellation = tweenEnclosure(svg, previousEnclosure, () => {
          if (this.cancelEnclosureTween === cancellation) this.cancelEnclosureTween = null;
          this.emitSelectionAnchor();
        });
        this.cancelEnclosureTween = cancellation;
        // The ghost cell: the cursor's own cell when empty (note level only —
        // wider rungs select what exists, the ghost is an entry affordance).
        const ghost = this.selection?.cursor;
        if (kind === 'cell' && ghost) drawCursorGhost(svg, ghost);
        if (!this.fontRedrawQueued && !document.fonts.check('4px Bravura')) {
          this.fontRedrawQueued = true;
          void document.fonts.ready.then(() => this.renderScore());
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
    // is a better thing for a readout to keep showing than a fabricated 100%.
    // Cast, not annotation: every assignment above happens inside a callback,
    // so control-flow analysis has narrowed `outcome` to `never` by here.
    const drawn = outcome as RenderOutcome | null;
    if (drawn) {
      const { pxPerSp, staffScale: used, fitted } = drawn;
      // The packing rides along on the same paint, for `densitySteps()`. It is
      // NOT in the event: the detail stays exactly `RenderScale`, because a
      // host wants the answer ("which values do something?"), not the input.
      this.lastPackings = drawn.packings;
      this.lastDensityH = densityH;
      this.dispatchEvent(
        new CustomEvent<RenderScale>('render-scale', {
          detail: { pxPerSp, staffScale: used, fitted },
          bubbles: true,
          composed: true
        })
      );
    }

    this.emitSelectionAnchor();
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
   * and the staff scale, all of which move.
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
   * width and the staff scale, both of which move. The selection ladder's
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
    const enclosure = this.container?.querySelector<SVGGElement>('svg .enclosure');
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
  private resolvedView(): ViewMode {
    const asked = this.view === 'auto' ? declaredStaffKind(this.mnxDoc?.mnxJson) : this.view;
    if (asked !== 'tab' && asked !== 'both') return 'notation';
    return this.tabCapable() ? asked : 'notation';
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

    return html`
      <div class="paper">
        ${this.renderErrors.length
          ? html`
              <div class="state-panel">
                <h3><span class="sp-warn"></span>Validates, doesn’t render yet</h3>
                <p>
                  The document passes both verdicts, but the layout engine doesn’t support a
                  feature it uses. That’s an honest gap, not an error — the uncovered def sits on
                  the coverage backlog, and this scenario is its test fixture-in-waiting.
                </p>
                ${this.renderErrors.map(
                  f => html`<code class="fail-code">layout (${f.pane}): ${f.message}</code>`
                )}
              </div>
            `
          : nothing}
        <div id="score-container"></div>
      </div>
    `;
  }

}

export default ScoreViewer;
