import { LitElement, html, css, svg, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { designTokens, sharedChrome } from './tokens.ts';
import type { DisplayOptions } from '../engine/displayOptions.ts';
import type { ViewMode } from './DocumentViewer.ts';
import type { Player } from './Player.ts';
import type { PlaybackUpdate } from './mnxContext.ts';
import { formatPlaybackPosition } from '../audio/playbackPosition.ts';
import './ZoomPad.ts';
import './SettingsPad.ts';

/**
 * The score frame — roadmap/inprogress/core-score-frame.md, from the *Studio
 * Controls* design canvas (edge grips, 2026-09-11).
 *
 * The score pane owns TWO GRIPS, one on each horizontal edge, and a hairline
 * progress line along the bottom. Nothing here listens for a tap on the score:
 * a tap on the page is navigation (seek to a bar; later, select a note), and
 * the chrome is reached only through its grips.
 *
 *   quiet      — a title grip on the top edge, a pause grip on the bottom edge
 *                (pause/play · the position readout · a chevron). Pause and the
 *                way to the chrome are on screen at 44px at all times.
 *   drawn out  — the top grip becomes the library page's tools row: the way
 *                back (slot `back`), the title at h1 weight with the sub-line
 *                muted, the piece's chips (slot `chips`), then the staff view as
 *                the library's sort control, Zoom and Settings hosting the two
 *                pads *pinned* under their buttons, extra buttons (slot
 *                `actions` — the workbench's Focus), a menu (slot `menu`) and
 *                the collapse chevron. The bottom grip becomes the player's own
 *                tray (slot `player`).
 *
 * Below ~1000px of pane the tools row wraps to its stacked form; a phone and
 * the workbench's pane beside its rail and side panel both hit it.
 *
 * ONE ELEMENT, TWO HOSTS. Studio mounts it on the piece page; the workbench on
 * the scenario page's score pane. The frame owns only which strip is open; every
 * value it shows comes in as a property and every change leaves as the pads'
 * own events (`view-change`, `display-change`, `unrolled-change`, `zoom-change`,
 * `spacing-mode-change`, `clearance-change`, `document-focus-toggle`), which
 * bubble composed through the frame for the host to store — the pads are
 * chrome, not surface, and so is this.
 *
 * The grip's pause and readout come from the slotted `<mnx-player>`: its
 * `playback-state-changed` frames bubble through the frame, and the grip calls
 * `play()`/`pause()` on it. The player is the host's — the frame never creates
 * one — so the binding the host already made (`bindPlayback`) is untouched.
 */

const ALL_VIEWS: readonly ViewMode[] = ['notation', 'tab', 'both'];
const VIEW_WORDS: Record<ViewMode, string> = { notation: 'Notation', tab: 'Tab', both: 'Both' };
const NO_STRINGS = 'Needs known strings — declare strings[] in the document, or set an instrument override';

type Pad = 'zoom' | 'settings' | null;

@customElement('mnx-score-frame')
export class ScoreFrame extends LitElement {
  /** What the title grip and the tools row print. */
  @property() heading = '';
  @property() subheading = '';

  /** The staff view, and the views this document can support. */
  @property({ type: String }) view: ViewMode = 'notation';
  @property({ attribute: false }) views: ViewMode[] = ['notation'];

  /** The settings card's inputs. */
  @property({ attribute: false }) display: DisplayOptions = {};
  @property({ type: Boolean }) unrolled = false;

  /** The zoom pad's inputs — see ZoomPad for each. */
  @property({ type: Number }) staffScale: number | null = null;
  @property({ type: Number }) densityH: number | null = null;
  @property() spacingMode: 'natural' | 'fill' = 'fill';
  @property({ type: Number }) clearance = 2;
  @property({ type: Number }) effectiveStaffScale = 1;
  @property({ attribute: false }) densitySteps: (() => number[] | null) | null = null;
  @property({ type: Boolean, reflect: true, attribute: 'document-focus' }) documentFocus = false;

  /** Whether Zoom and Settings are offered at all — a score still loading, or one
   *  the host cannot lay out, has nothing for them to change. */
  @property({ type: Boolean }) pads = true;

  @state() private topOpen = false;
  @state() private bottomOpen = false;
  @state() private pad: Pad = null;
  @state() private playing = false;
  @state() private positionText = '';
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
        --grip-shadow: 0 1px 2px var(--shadow-near), 0 3px 10px var(--shadow-far);
      }

      /* ── the pane ──
         The frame is a column: an open strip is IN FLOW above or below the
         pane, so the score moves out from under it rather than being covered;
         the grips float over the pane's edges. The pane is the SCROLL
         CONTAINER — the host gives the frame a height and the score scrolls
         inside, so the grips sit on the pane's edges rather than the
         document's. Bottom padding keeps the last system scrollable out from
         under the pause grip. */
      .pane {
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
      }

      .score {
        position: absolute;
        inset: 0;
        overflow: auto;
        box-sizing: border-box;
        padding: 0 0 64px;
      }

      :host([data-bottom]) .score {
        padding-bottom: 0;
      }

      /* ── the grips ──
         Pills on the edges, in the bar's ground with a hairline, squared on
         the edge they hang from. */
      .grip {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        z-index: 3;
        display: flex;
        align-items: center;
        gap: 8px;
        max-width: calc(100% - 32px);
        box-sizing: border-box;
        background: var(--frame-bar);
        border: 1px solid var(--line);
        backdrop-filter: blur(6px);
        box-shadow: var(--grip-shadow);
        cursor: pointer;
        font: inherit;
        color: inherit;
        padding: 0;
        text-align: left;
      }

      .grip.top {
        top: 0;
        height: 36px;
        padding: 0 8px 0 14px;
        border-top: 0;
        border-radius: 0 0 var(--frame-radius) var(--frame-radius);
      }

      .grip.bottom {
        bottom: 3px;
        padding: 4px 6px 4px 4px;
        border-bottom: 0;
        border-radius: var(--frame-radius) var(--frame-radius) 0 0;
      }

      .grip .name {
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .grip .sub {
        color: var(--ink-3);
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .grip .chev {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 44px;
        color: var(--ink-3);
        flex: none;
      }

      .grip.top .chev {
        height: 36px;
        width: 28px;
      }

      /* ── the transport's primary: pause/play on the accent ── */
      .primary {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        flex: none;
        background: var(--accent);
        color: #fff;
        border: 0;
        border-radius: var(--frame-radius);
        cursor: pointer;
        padding: 0;
      }

      .primary:disabled {
        opacity: 0.4;
        cursor: default;
      }

      .readout {
        font: 500 12px/1 var(--mono);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        margin: 0 6px;
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
         Drawn out, each edge is the library's tools row: the bar's ground, a
         hairline, blur; 40px controls. */
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
      .grip:focus-visible,
      .primary:focus-visible {
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

      /* The player fills the bottom strip; its own styles do the rest. */
      ::slotted([slot='player']) {
        flex: 1;
        min-width: 0;
        height: auto;
        padding: 0;
        border: 0;
      }

      .strip.bottom .btn.ghost {
        margin-top: 4px;
      }
    `
  ];

  // ── the player ──────────────────────────────────────────────────────────
  // A light-DOM child of the frame; its frames bubble through the frame's own tree.

  private readonly onPlayback = (event: Event) => {
    const detail = (event as CustomEvent<PlaybackUpdate>).detail;
    this.playing = detail.playing === true;
    this.refreshReadout(detail.ordinal);
  };

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('playback-state-changed', this.onPlayback);
  }

  disconnectedCallback() {
    this.removeEventListener('playback-state-changed', this.onPlayback);
    document.removeEventListener('pointerdown', this.onClickAway);
    super.disconnectedCallback();
  }

  private refreshReadout(ordinal: number | null) {
    const player = this.player;
    const performance = player?.performance ?? null;
    this.hasPerformance = performance !== null;
    if (!player || !performance) {
      this.positionText = '';
      this.progress = 0;
      return;
    }
    this.positionText = formatPlaybackPosition(performance, player.position, player.document);
    const count = performance.measures.length;
    this.progress = ordinal === null || count === 0 ? 0 : Math.min(1, (ordinal + 0.5) / count);
  }

  private togglePlay() {
    const player = this.player;
    if (!player) return;
    if (this.playing) player.pause();
    else void player.play();
  }

  // ── the strips ──────────────────────────────────────────────────────────

  private setTop(open: boolean) {
    this.topOpen = open;
    if (!open) this.pad = null;
  }

  private togglePad(which: Exclude<Pad, null>) {
    this.pad = this.pad === which ? null : which;
  }

  private emitView(value: ViewMode) {
    if (value === this.view) return;
    this.dispatchEvent(new CustomEvent('view-change', { detail: value, bubbles: true, composed: true }));
  }

  protected updated() {
    this.toggleAttribute('data-top', this.topOpen);
    this.toggleAttribute('data-bottom', this.bottomOpen);
  }

  private readonly onKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    if (this.pad) {
      this.pad = null;
      event.stopPropagation();
    } else if (this.topOpen || this.bottomOpen) {
      this.setTop(false);
      this.bottomOpen = false;
      event.stopPropagation();
    }
  };

  private readonly onClickAway = (event: PointerEvent) => {
    // A pad closes when the pointer lands outside its button and card; the
    // strips stay — they are closed by their chevrons or Escape, never by
    // a tap on the score, which is navigation.
    if (!this.pad) return;
    const path = event.composedPath();
    const inside = path.some(node => node instanceof HTMLElement && node.classList.contains('anchor'));
    if (!inside) this.pad = null;
  };

  protected firstUpdated() {
    this.renderRoot.addEventListener('keydown', this.onKeydown as EventListener);
    document.addEventListener('pointerdown', this.onClickAway);
    this.refreshReadout(null);
  }

  // ── glyphs: the library page's round-capped strokes ─────────────────────

  private static glyph(d: string, px = 16, w = 2) {
    return svg`<svg width=${px} height=${px} viewBox="0 0 24 24" aria-hidden="true"><path d=${d} fill="none" stroke="currentColor" stroke-width=${w} stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
  }

  private static filled(d: string, px = 22) {
    return svg`<svg width=${px} height=${px} viewBox="0 0 24 24" aria-hidden="true"><path d=${d} fill="currentColor"></path></svg>`;
  }

  private static get chevronDown() { return ScoreFrame.glyph('M6 9l6 6 6-6'); }
  private static get chevronUp() { return ScoreFrame.glyph('M6 15l6-6 6 6'); }
  private static get pause() { return ScoreFrame.filled('M7 5h3.5v14H7zM13.5 5H17v14h-3.5z'); }
  private static get play() { return ScoreFrame.filled('M8 5l11 7-11 7z'); }

  /** The pads' own marks, so the buttons say what they open. */
  private static get crosshair() {
    return svg`<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l4 4h-2.5v3h-3V6H8zM12 22l-4-4h2.5v-3h3v3H16zM2 12l4-4v2.5h3v3H6V16zM22 12l-4 4v-2.5h-3v-3h3V8z"></path></svg>`;
  }

  private static get gear() {
    return svg`<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="3.4" stroke-dasharray="3.14 3.14" stroke-dashoffset="1.57"></circle><circle cx="12" cy="12" r="6.6" fill="none" stroke="currentColor" stroke-width="1.6"></circle><circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"></circle></svg>`;
  }

  // ── render ──────────────────────────────────────────────────────────────

  private primaryButton() {
    return html`<button
      class="primary"
      type="button"
      ?disabled=${!this.hasPerformance}
      aria-label=${this.playing ? 'Pause' : 'Play'}
      @click=${this.togglePlay}
    >${this.playing ? ScoreFrame.pause : ScoreFrame.play}</button>`;
  }

  private topGrip() {
    return html`<button
      class="grip top"
      type="button"
      aria-expanded="false"
      aria-label=${`${this.heading || 'Score'} — show the tools`}
      @click=${() => this.setTop(true)}
    >
      <span class="name">${this.heading}</span>
      ${this.subheading ? html`<span class="sub">${this.subheading}</span>` : nothing}
      <span class="chev">${ScoreFrame.chevronDown}</span>
    </button>`;
  }

  private bottomGrip() {
    return html`<div class="grip bottom" role="group" aria-label="Playback">
      ${this.primaryButton()}
      ${this.positionText ? html`<span class="readout">${this.positionText}</span>` : nothing}
      <button
        class="chev"
        type="button"
        style="background: none; border: 0; cursor: pointer; padding: 0;"
        aria-expanded="false"
        aria-label="Show the player"
        @click=${() => (this.bottomOpen = true)}
      >${ScoreFrame.chevronUp}</button>
    </div>`;
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
        ${this.segmented()}
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
                        .clearance=${this.clearance}
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
        <button class="btn icon ghost" type="button" aria-label="Hide the tools" @click=${() => this.setTop(false)}>
          ${ScoreFrame.chevronUp}
        </button>
      </div>
    </div>`;
  }

  private bottomStrip() {
    return html`<div class="strip bottom">
      <slot name="player"></slot>
      <button class="btn icon ghost" type="button" aria-label="Hide the player" @click=${() => (this.bottomOpen = false)}>
        ${ScoreFrame.chevronDown}
      </button>
    </div>`;
  }

  render() {
    return html`
      ${this.topOpen ? this.topStrip() : nothing}
      <div class="pane">
        <div class="score"><slot></slot></div>
        ${this.topOpen ? nothing : this.topGrip()}
        ${this.bottomOpen ? nothing : this.bottomGrip()}
        ${this.hasPerformance && !this.bottomOpen
          ? html`<div class="progress" aria-hidden="true"><div style="width: ${this.progress * 100}%"></div></div>`
          : nothing}
      </div>
      ${this.bottomOpen ? this.bottomStrip() : nothing}
      <!-- The player is the host's light-DOM child in both poses: unmounting
           it would tear down its transport. Closed, it is parked here, out of
           the flow, and the grip speaks for it. -->
      ${this.bottomOpen ? nothing : html`<div hidden><slot name="player"></slot></div>`}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mnx-score-frame': ScoreFrame;
  }
}
