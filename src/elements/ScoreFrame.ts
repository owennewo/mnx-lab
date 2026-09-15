import { LitElement, html, css, svg, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { designTokens, sharedChrome } from './tokens.ts';
import type { DisplayOptions } from '../engine/displayOptions.ts';
import type { ViewMode } from './DocumentViewer.ts';
import type { Player } from './Player.ts';
import type { PlaybackUpdate } from './mnxContext.ts';
import './ZoomPad.ts';
import './SettingsPad.ts';

/**
 * The score frame — roadmap/inprogress/core-score-frame.md, from the *Studio
 * Controls* design canvas (2026-09-11), revised 2026-09-15 to one toggle.
 *
 * The score pane sits between TWO STRIPS in the library page's vocabulary —
 * the tools row above, the player's tray below — and ONE MARK on the pane's
 * top-right corner, faded until the pointer reaches it, hides and shows both
 * strips together. Nothing here listens for a tap on the score: a tap on the
 * page is navigation (seek to a bar; later, select a note), and the chrome is
 * reached only through the mark.
 *
 *   unfocused — the tools row: the way back (slot `back`), the title at h1
 *               weight with the sub-line muted, the piece's chips (slot
 *               `chips`), then the staff view as the library's sort control
 *               (opt-out: `staff-view` false — the settings card carries the
 *               same row, and studio shows only that), Zoom and Settings
 *               hosting the two pads *pinned* under their buttons, extra
 *               buttons (slot `actions`) and a menu (slot `menu`). Under the
 *               score, the player's own tray (slot `player`).
 *   focused   — the score alone, a hairline progress line along the bottom
 *               edge, and the mark to come back by.
 *
 * The edge grips the frame first shipped with — a title grip and a playback
 * grip, each strip drawn out and put away on its own — were retired on
 * 2026-09-15 for the one mark: the strips no longer have a reduced form.
 *
 * Below ~1000px of pane the tools row wraps to its stacked form; a phone and
 * the workbench's pane beside its rail and side panel both hit it.
 *
 * ONE ELEMENT, TWO HOSTS. Studio mounts it on the piece page; the workbench on
 * the scenario page's score pane. Every value the frame shows comes in as a
 * property and every change leaves as the pads' own events (`view-change`,
 * `display-change`, `unrolled-change`, `zoom-change`, `spacing-mode-change`,
 * `document-focus-toggle`), which bubble composed through
 * the frame for the host to store — the pads are chrome, not surface, and so
 * is this. Focus follows the same rule: `focused` is a property the host may
 * set (studio's remembered choice; the workbench's document focus), and every
 * toggle from the mark leaves as `focus-change` (detail: the new boolean) for
 * the host to remember or ignore. Which pad is up stays the frame's own — a
 * popover is not a preference.
 *
 * The progress line reads the slotted `<mnx-player>`: its
 * `playback-state-changed` frames bubble through the frame. The player is the
 * host's — the frame never creates one — so the binding the host already made
 * (`bindPlayback`) is untouched.
 */

const ALL_VIEWS: readonly ViewMode[] = ['notation', 'tab', 'both'];
const VIEW_WORDS: Record<ViewMode, string> = { notation: 'Notation', tab: 'Tab', both: 'Both' };
const NO_STRINGS = 'Needs known strings — declare strings[] in the document, or set an instrument override';

type Pad = 'zoom' | 'settings' | null;

@customElement('mnx-score-frame')
export class ScoreFrame extends LitElement {
  /** What the tools row prints. */
  @property() heading = '';
  @property() subheading = '';

  /** The staff view, and the views this document can support. */
  @property({ type: String }) view: ViewMode = 'notation';
  @property({ attribute: false }) views: ViewMode[] = ['notation'];
  /** Whether the tools row prints the segmented staff view beside the pads.
   *  The settings card's STAFF row is the same setting, so a host may leave
   *  the row to that alone (studio does) and keep the strip for its buttons. */
  @property({ type: Boolean, attribute: 'staff-view' }) staffView = true;

  /** The settings card's inputs. */
  @property({ attribute: false }) display: DisplayOptions = {};
  @property({ type: Boolean }) unrolled = false;

  /** The zoom pad's inputs — see ZoomPad for each. */
  @property({ type: Number }) staffScale: number | null = null;
  @property({ type: Number }) densityH: number | null = null;
  @property() spacingMode: 'natural' | 'fill' = 'fill';
  @property({ type: Number }) effectiveStaffScale = 1;
  @property({ attribute: false }) densitySteps: (() => number[] | null) | null = null;
  @property({ type: Boolean, reflect: true, attribute: 'document-focus' }) documentFocus = false;

  /** Whether Zoom and Settings are offered at all — a score still loading, or one
   *  the host cannot lay out, has nothing for them to change. */
  @property({ type: Boolean }) pads = true;

  /** Whether the strips are hidden — the host's to pin (see the note above). */
  @property({ type: Boolean, reflect: true }) focused = false;
  /** A shortcut the host binds to the same toggle, printed in the mark's tooltip. */
  @property({ attribute: 'focus-shortcut' }) focusShortcut = '';
  @state() private videoOpen = false;
  @state() private videoWidth = 320;
  private videoObserver: ResizeObserver | null = null;
  /** Watches the slotted scroller's content box: a vertical scrollbar coming
   *  or going changes it without changing the element's size. */
  private scrollerObserver: ResizeObserver | null = null;
  private readonly onScoreSlot = (event: Event) => {
    const slot = event.target as HTMLSlotElement;
    this.scrollerObserver?.disconnect();
    for (const element of slot.assignedElements()) this.scrollerObserver?.observe(element);
    this.measureScrollbar(slot.assignedElements());
  };
  private measureScrollbar(elements: Element[]) {
    let width = 0;
    for (const element of elements) {
      if (!(element instanceof HTMLElement)) continue;
      width = Math.max(width, element.offsetWidth - element.clientWidth - 2 * element.clientLeft);
    }
    this.style.setProperty('--score-scrollbar', `${Math.max(0, width)}px`);
  }
  private get videoMaximum() { return Math.max(200, this.clientWidth * 0.75); }
  private resizeVideo(width: number) { this.videoWidth = Math.max(200, Math.min(this.videoMaximum, width)); }
  private readonly dragVideo = (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const divider = event.currentTarget as HTMLElement;
    // Cross-origin iframe hit-testing can swallow captured pointer moves.
    // Suspend its pointer target only for the active drag, without an overlay.
    this.player?.pause();
    const video = this.renderRoot.querySelector<HTMLIFrameElement>('.video-surface iframe');
    if (video) video.style.pointerEvents = 'none';
    divider.setPointerCapture(event.pointerId);
    const start = event.clientX, width = this.videoWidth;
    const move = (e: PointerEvent) => this.resizeVideo(width + e.clientX - start);
    const end = () => {
      if (video) video.style.pointerEvents = '';
      divider.removeEventListener('pointermove', move);
      divider.removeEventListener('lostpointercapture', end);
    };
    divider.addEventListener('pointermove', move);
    divider.addEventListener('lostpointercapture', end);
  };
  private readonly resizeVideoKey = (event: KeyboardEvent) => {
    const width = event.key === 'Home' ? 200 : event.key === 'End' ? this.videoMaximum
      : event.key === 'ArrowLeft' ? this.videoWidth - 20 : event.key === 'ArrowRight' ? this.videoWidth + 20 : null;
    if (width === null) return;
    event.preventDefault(); this.resizeVideo(width);
  };
  @state() private pad: Pad = null;
  @state() private progress = 0;
  @state() private hasPerformance = false;

  /** The host's player, a light-DOM child in the `player` slot. */
  private get player(): Player | null {
    return this.querySelector<Player>('mnx-player');
  }

  static styles = [
    designTokens,
    sharedChrome,
    css`
      :host {
        display: flex;
        flex-direction: column;
        position: relative;
        container-type: inline-size;
        font-family: var(--sans);
        font-size: 14px;
        line-height: 1.4;
        color: var(--ink);
        /* The library page's vocabulary: its grey ground and its bar. */
        --frame-ground: light-dark(oklch(0.9 0.004 60), oklch(0.26 0.006 60));
        --frame-bar: light-dark(oklch(0.985 0.002 60 / 0.92), oklch(0.22 0.004 60 / 0.92));
        --frame-radius: 3px;
        --frame-shadow: 0 1px 2px var(--shadow-near), 0 3px 10px var(--shadow-far);
      }

      /* ── the pane ──
         The frame is a column: the strips are IN FLOW above and below the
         pane, so the score moves out from under them rather than being
         covered; the mark floats over the pane's corner. The pane is the
         SCROLL CONTAINER — the host gives the frame a height and the score
         scrolls inside, so the mark sits on the pane's corner rather than the
         document's. */
      .workspace { display: flex; flex: 1 1 auto; min-height: 0; min-width: 0; }
      .video-pane { display: flex; flex-direction: column; flex: none; min-width: 200px; overflow: auto; }
      .video-surface { width: 100%; height: var(--video-height); flex: 0 1 var(--video-height); min-height: 200px; }
      .video-controls { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px; flex: none; }
      .video-controls .btn { white-space: normal; }
      .youtube-notice { padding: 12px; overflow-wrap: anywhere; }
      .youtube-notice h3 { margin-top: 0; }
      .youtube-notice a { color: inherit; text-decoration: underline; }
      .youtube-notice button { margin: 4px 4px 0 0; padding: 8px; color: inherit; background: var(--frame-bar); border: 1px solid var(--ink-muted); border-radius: 3px; cursor: pointer; }
      .video-divider { flex: 0 0 8px; cursor: col-resize; touch-action: none; background: var(--frame-ground); }
      .video-divider:hover, .video-divider:focus-visible { background: var(--ink-muted); outline: 2px solid var(--ink); outline-offset: -2px; }
      .video-pane[hidden], .video-divider[hidden], .video-surface[hidden], .video-controls[hidden] { display: none; }
      .pane {
        min-width: 0;
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
      }

      .score {
        position: absolute;
        inset: 0;
        overflow: auto;
      }

      /* ── the focus mark ──
         One toggle for both strips: a tab hanging from the pane's top-right
         corner, squared on the two edges it hangs from (the grips' own
         language), in the bar's ground with a hairline. It sits flush beside
         the score's vertical scrollbar rather than over it — the frame
         measures the slotted scroller's bar and sets --score-scrollbar.
         Faded at rest so it reads as a fixture rather than a control; full
         strength when the pointer reaches it or the keyboard lands on it.
         40px, so it is catchable on glass, where there is no hover and it
         stays faded. */
      .focus-mark {
        position: absolute;
        top: 0;
        right: var(--score-scrollbar, 0px);
        z-index: 3;
        display: grid;
        place-items: center;
        width: 44px;
        height: 40px;
        padding: 0;
        box-sizing: border-box;
        background: var(--frame-bar);
        border: 1px solid var(--line);
        border-top: 0;
        border-right: 0;
        border-radius: 0 0 0 var(--frame-radius);
        backdrop-filter: blur(6px);
        box-shadow: var(--frame-shadow);
        color: var(--ink);
        cursor: pointer;
        opacity: 0.3;
        transition: opacity 0.12s ease;
      }

      .focus-mark:hover,
      .focus-mark:focus-visible {
        opacity: 1;
      }

      @media (prefers-reduced-motion: reduce) {
        .focus-mark {
          transition: none;
        }
      }

      /* ── the progress line ── */
      .progress {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 3px;
        background: var(--line);
        z-index: 2;
        pointer-events: none;
      }

      .progress > div {
        height: 100%;
        background: var(--accent);
        transition: width 120ms linear;
      }

      /* ── the strips ──
         Each edge is the library's tools row: the bar's ground, a hairline,
         blur; 40px controls. */
      .strip {
        position: relative;
        flex: none;
        z-index: 3;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px 12px;
        padding: 10px 16px;
        box-sizing: border-box;
        background: var(--frame-bar);
        backdrop-filter: blur(6px);
      }

      .strip.top {
        /* Above the bottom strip, so an open pad paints over the tray. */
        z-index: 4;
        border-bottom: 1px solid var(--line);
      }

      .strip.bottom {
        border-top: 1px solid var(--line);
        align-items: flex-start;
      }

      /* Wide: the two groups are transparent and everything sits in one row.
         Narrow: each group is its own row — the way back and the menu on the
         first, the head on the second, the tools on the third. */
      .head-row,
      .tools-row {
        display: contents;
      }

      .head {
        display: flex;
        align-items: baseline;
        gap: 10px;
        min-width: 0;
      }

      .head h1 {
        margin: 0;
        font-size: 1.4rem;
        font-weight: 600;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .head .sub {
        color: var(--ink-3);
        font-size: 13px;
        white-space: nowrap;
      }

      .spacer {
        flex: 1;
      }

      .end {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      @container (max-width: 1000px) {
        .head-row {
          display: flex;
          align-items: baseline;
          gap: 10px;
          flex-basis: 100%;
          order: 2;
          min-width: 0;
          padding: 0 4px;
        }

        .tools-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-basis: 100%;
          order: 3;
        }

        .strip.top .spacer {
          display: none;
        }

        .tools-row .spacer {
          display: block;
        }

        .end {
          margin-left: auto;
          order: 1;
        }
      }

      /* ── the library's controls ── */
      .btn,
      ::slotted(a),
      ::slotted(button) {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        height: 40px;
        padding: 0 12px;
        box-sizing: border-box;
        border: 1px solid var(--line);
        border-radius: var(--frame-radius);
        background: transparent;
        color: var(--ink);
        font: inherit;
        text-decoration: none;
        cursor: pointer;
        white-space: nowrap;
      }

      .btn.icon {
        width: 40px;
        padding: 0;
      }

      .btn.ghost {
        border-color: transparent;
        color: var(--ink-3);
      }

      .btn.on {
        background: var(--frame-ground);
      }

      .btn:hover,
      ::slotted(a:hover),
      ::slotted(button:hover) {
        border-color: var(--ink-3);
      }

      .btn.ghost:hover {
        border-color: transparent;
        color: var(--ink);
      }

      .btn:focus-visible,
      .focus-mark:focus-visible {
        outline: var(--rule-w) solid var(--focus-ring);
        outline-offset: 2px;
      }

      /* The library's .line: borderless, for the way back. */
      ::slotted([slot='back']) {
        border-color: transparent;
        padding: 0 10px 0 8px;
      }

      ::slotted([slot='chips']) {
        display: flex;
        gap: 8px;
        height: auto;
        padding: 0;
        border: 0;
      }

      /* The library's sort control, for the staff view. */
      .seg {
        display: flex;
        height: 40px;
        border: 1px solid var(--line);
        border-radius: var(--frame-radius);
        overflow: hidden;
      }

      .seg button {
        border: 0;
        border-radius: 0;
        padding: 0 12px;
        font: inherit;
        font-size: 13px;
        color: var(--ink-3);
        background: transparent;
        cursor: pointer;
      }

      .seg button + button {
        border-left: 1px solid var(--line);
      }

      .seg button[aria-pressed='true'] {
        color: var(--ink);
        background: var(--frame-ground);
      }

      .seg button:disabled {
        opacity: 0.45;
        cursor: default;
      }

      /* A pad hangs under its button, right edge to right edge. */
      .anchor {
        position: relative;
      }

      .popover {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        z-index: 5;
      }

      /* A host's side panel (studio's Instruments sheet): in flow beside the
         pane, between the strips, so the score narrows rather than being
         covered and the tray stays in reach. */
      ::slotted([slot='side']) {
        flex: none;
        min-height: 0;
      }

      /* The player fills the bottom strip; its own styles do the rest. */
      ::slotted([slot='player']) {
        flex: 1;
        min-width: 0;
        height: auto;
        padding: 0;
        border: 0;
      }
    `
  ];

  // ── the player ──────────────────────────────────────────────────────────
  // A light-DOM child of the frame; its frames bubble through the frame's own tree.

  private readonly onPlayback = (event: Event) => {
    const detail = (event as CustomEvent<PlaybackUpdate>).detail;
    this.videoOpen = this.player?.youtubeRegionVisible ?? false;
    this.refreshProgress(detail.ordinal);
  };

  private readonly onVideo = (event: Event) => {
    // The video's controls are the tray's: a video coming up brings the strips back.
    this.setFocused(false);
    const region = (event as CustomEvent<{ mount?: Promise<HTMLElement> } | undefined>).detail;
    if (this.player) this.player.videoPaneHosted = true;
    this.videoOpen = this.player?.youtubeRegionVisible ?? false;
    if (!region) return;
    this.videoOpen = true;
    this.resizeVideo(this.videoWidth);
    region.mount = this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>('.video-surface')!);
  };

  private readonly onVideoNotice = () => {
    this.videoOpen = this.player?.youtubeRegionVisible ?? false;
    this.requestUpdate();
  };

  private readonly onPosition = () => {
    this.videoOpen = this.player?.youtubeRegionVisible ?? false;
    this.refreshProgress(this.player?.scorePosition?.ordinal ?? null);
  };

  private readonly onPerformance = () => this.refreshProgress(null);

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('playback-state-changed', this.onPlayback);
    this.addEventListener('performance-changed', this.onPerformance);
    this.addEventListener('playback-position', this.onPosition);
    this.addEventListener('video-region-changed', this.onVideo);
    this.addEventListener('video-notice-changed', this.onVideoNotice);
    this.videoObserver = new ResizeObserver(() => { this.resizeVideo(this.videoWidth); this.requestUpdate(); });
    this.videoObserver.observe(this);
    this.scrollerObserver = new ResizeObserver(entries => this.measureScrollbar(entries.map(entry => entry.target)));
  }

  disconnectedCallback() {
    this.removeEventListener('playback-state-changed', this.onPlayback);
    this.removeEventListener('performance-changed', this.onPerformance);
    this.removeEventListener('playback-position', this.onPosition);
    this.removeEventListener('video-region-changed', this.onVideo);
    this.removeEventListener('video-notice-changed', this.onVideoNotice);
    this.videoObserver?.disconnect();
    this.videoObserver = null;
    this.scrollerObserver?.disconnect();
    this.scrollerObserver = null;
    document.removeEventListener('pointerdown', this.onClickAway);
    super.disconnectedCallback();
  }

  private refreshProgress(ordinal: number | null) {
    const performance = this.player?.performance ?? null;
    this.hasPerformance = performance !== null;
    if (!performance) {
      this.progress = 0;
      return;
    }
    const count = performance.measures.length;
    this.progress = ordinal === null || count === 0 ? 0 : Math.min(1, (ordinal + 0.5) / count);
  }

  // ── focus ───────────────────────────────────────────────────────────────

  private setFocused(focused: boolean) {
    // The tray goes with the strips, and a YouTube video's controls with it:
    // the video pauses rather than play on with its tray gone
    // (docs/player-youtube.md); Play in the tray resumes it.
    if (focused && this.player?.playback?.kind === 'youtube') this.player.pause();
    if (this.focused === focused) return;
    this.focused = focused;
    this.dispatchEvent(new CustomEvent<boolean>('focus-change', { detail: focused, bubbles: true, composed: true }));
  }

  private togglePad(which: Exclude<Pad, null>) {
    this.pad = this.pad === which ? null : which;
  }

  private emitView(value: ViewMode) {
    if (value === this.view) return;
    this.dispatchEvent(new CustomEvent('view-change', { detail: value, bubbles: true, composed: true }));
  }

  protected willUpdate(changed: PropertyValues<this>) {
    // A pad hangs under the tools row; focusing takes the row and the pad with it.
    if (changed.has('focused') && this.focused) this.pad = null;
  }

  private readonly onKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !this.pad) return;
    this.pad = null;
    event.stopPropagation();
  };

  private readonly onClickAway = (event: PointerEvent) => {
    // A pad closes when the pointer lands outside its button and card; the
    // strips stay — they go only with the mark, never with a tap on the
    // score, which is navigation.
    if (!this.pad) return;
    const path = event.composedPath();
    const inside = path.some(node => node instanceof HTMLElement && node.classList.contains('anchor'));
    if (!inside) this.pad = null;
  };

  protected firstUpdated() {
    this.renderRoot.addEventListener('keydown', this.onKeydown as EventListener);
    document.addEventListener('pointerdown', this.onClickAway);
    this.refreshProgress(null);
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('.score slot');
    if (slot) this.onScoreSlot({ target: slot } as unknown as Event);
  }

  // ── glyphs: the library page's round-capped strokes ─────────────────────

  private static glyph(d: string, px = 16, w = 2) {
    return svg`<svg width=${px} height=${px} viewBox="0 0 24 24" aria-hidden="true"><path d=${d} fill="none" stroke="currentColor" stroke-width=${w} stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
  }

  /** The mark: corners drawn outward to focus on the score, inward to come back. */
  private static get focusIn() { return ScoreFrame.glyph('M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5', 18); }
  private static get focusOut() { return ScoreFrame.glyph('M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5', 18); }

  /** The pads' own marks, so the buttons say what they open. */
  private static get crosshair() {
    return svg`<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l4 4h-2.5v3h-3V6H8zM12 22l-4-4h2.5v-3h3v3H16zM2 12l4-4v2.5h3v3H6V16zM22 12l-4 4v-2.5h-3v-3h3V8z"></path></svg>`;
  }

  private static get gear() {
    return svg`<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="3.4" stroke-dasharray="3.14 3.14" stroke-dashoffset="1.57"></circle><circle cx="12" cy="12" r="6.6" fill="none" stroke="currentColor" stroke-width="1.6"></circle><circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"></circle></svg>`;
  }

  // ── render ──────────────────────────────────────────────────────────────

  private focusMark() {
    const label = this.focused ? 'Show the tools and the player' : 'Focus on the score';
    return html`<button
      class="focus-mark"
      type="button"
      aria-pressed=${this.focused}
      aria-label=${label}
      title=${this.focusShortcut ? `${label} (${this.focusShortcut})` : label}
      @click=${() => this.setFocused(!this.focused)}
    >${this.focused ? ScoreFrame.focusOut : ScoreFrame.focusIn}</button>`;
  }

  private segmented() {
    return html`<div class="seg" role="group" aria-label="Staff view">
      ${ALL_VIEWS.map(v => {
        const offered = this.views.includes(v);
        return html`<button
          type="button"
          aria-pressed=${v === this.view}
          ?disabled=${!offered}
          title=${offered ? nothing : NO_STRINGS}
          @click=${() => this.emitView(v)}
        >${VIEW_WORDS[v]}</button>`;
      })}
    </div>`;
  }

  private topStrip() {
    return html`<div class="strip top">
      <slot name="back"></slot>
      <div class="head-row">
        <div class="head">
          <h1>${this.heading}</h1>
          ${this.subheading ? html`<span class="sub">${this.subheading}</span>` : nothing}
        </div>
        <slot name="chips"></slot>
      </div>
      <div class="spacer"></div>
      <div class="tools-row">
        ${this.staffView ? this.segmented() : nothing}
        <div class="spacer"></div>
        ${this.pads
          ? html`
              <div class="anchor">
                <button class="btn ${this.pad === 'zoom' ? 'on' : ''}" type="button" aria-expanded=${this.pad === 'zoom'} @click=${() => this.togglePad('zoom')}>
                  ${ScoreFrame.crosshair}<span>Zoom</span>
                </button>
                ${this.pad === 'zoom'
                  ? html`<div class="popover">
                      <mnx-zoom-pad
                        pinned
                        .staffScale=${this.staffScale}
                        .densityH=${this.densityH}
                        .spacingMode=${this.spacingMode}
                        .densitySteps=${this.densitySteps}
                        .effectiveStaffScale=${this.effectiveStaffScale}
                        .documentFocus=${this.documentFocus}
                      ></mnx-zoom-pad>
                    </div>`
                  : nothing}
              </div>
              <div class="anchor">
                <button class="btn ${this.pad === 'settings' ? 'on' : ''}" type="button" aria-expanded=${this.pad === 'settings'} @click=${() => this.togglePad('settings')}>
                  ${ScoreFrame.gear}<span>Settings</span>
                </button>
                ${this.pad === 'settings'
                  ? html`<div class="popover">
                      <mnx-settings-pad
                        pinned
                        .display=${this.display}
                        .view=${this.view}
                        .views=${this.views}
                        .unrolled=${this.unrolled}
                      ></mnx-settings-pad>
                    </div>`
                  : nothing}
              </div>
            `
          : nothing}
        <slot name="actions"></slot>
      </div>
      <div class="end">
        <slot name="menu"></slot>
      </div>
    </div>`;
  }

  private bottomStrip() {
    return html`<div class="strip bottom">
      <slot name="player"></slot>
    </div>`;
  }

  render() {
    return html`
      ${this.focused ? nothing : this.topStrip()}
      <div class="workspace">
        <aside class="video-pane" aria-label="YouTube video" ?hidden=${!this.videoOpen}
          style="width: ${this.videoWidth}px; --video-height: ${Math.max(200, this.videoWidth * 9 / 16)}px">
          <div class="video-surface" ?hidden=${this.player?.playback?.kind !== 'youtube'}></div>
          <div class="video-controls" ?hidden=${this.player?.playback?.kind !== 'youtube'}>
            <button class="btn ghost" @click=${() => this.player?.showYouTubeNotice()}>Terms and privacy</button>
            <button class="btn ghost" @click=${() => { this.player?.pause(); void this.player?.selectSource('synth'); }}>Close video</button>
          </div>
          ${this.player?.renderYouTubeNotice() ?? nothing}
        </aside>
        <div class="video-divider" role="separator" tabindex="0" aria-label="Video pane width" aria-orientation="vertical"
          aria-valuemin="200" aria-valuemax=${Math.round(this.videoMaximum)} aria-valuenow=${Math.round(this.videoWidth)}
          ?hidden=${!this.videoOpen} @pointerdown=${this.dragVideo} @keydown=${this.resizeVideoKey}></div>
      <div class="pane">
        <div class="score"><slot @slotchange=${this.onScoreSlot}></slot></div>
        ${this.focusMark()}
        ${this.hasPerformance && this.focused
          ? html`<div class="progress" aria-hidden="true"><div style="width: ${this.progress * 100}%"></div></div>`
          : nothing}
      </div>
      <slot name="side"></slot>
      </div>
      ${this.focused ? nothing : this.bottomStrip()}
      <!-- The player is the host's light-DOM child in both poses: unmounting
           it would tear down its transport. Focused, it is parked here, out of
           the flow, and the progress line speaks for it. -->
      ${this.focused ? html`<div hidden><slot name="player"></slot></div>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mnx-score-frame': ScoreFrame;
  }
}
