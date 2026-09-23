import { LitElement, html, css, svg, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { designTokens, sharedChrome } from './tokens.ts';
import type { DisplayOptions } from '../engine/displayOptions.ts';
import type { ViewMode } from './DocumentViewer.ts';
import type { Player } from './Player.ts';
import type { PlaybackUpdate } from './mnxContext.ts';
import './ZoomPad.ts';
import './SettingsPad.ts';
import { DEFAULT_SPACE_SP, DEFAULT_SPACING_MODE, DEFAULT_STAFF_SP } from './zoomDefaults.ts';

/**
 * The score frame — roadmap/inprogress/core-score-frame.md, from the *Studio
 * Controls* design canvas (2026-09-11), revised 2026-09-15 to one toggle.
 *
 * The score pane sits between TWO STRIPS in the library page's vocabulary —
 * the tools row above, the player's tray below — and ONE MARK on the pane's
 * top-right corner, faded until the pointer reaches it, hides and shows both
 * strips together. In focus, Play/Pause sits beside that mark because the
 * player tray is parked. Nothing here listens for a tap on the score: a tap
 * on the page is navigation (seek to a bar; later, select a note), and the
 * chrome is reached only through the corner controls.
 *
 *   unfocused — the tools row: the way back (slot `back`), the title at h1
 *               weight with the sub-line muted, the piece's chips (slot
 *               `chips`), then the staff view as the library's sort control
 *               (opt-out: `staff-view` false — the settings card carries the
 *               same row, and studio shows only that), Zoom and Settings
 *               hosting the two pads *pinned* under their buttons, extra
 *               buttons (slot `actions`) and a menu (slot `menu`). Under the
 *               score, the player's own tray (slot `player`).
 *   focused   — the score, a hairline progress line along the bottom edge,
 *               Play/Pause, and the mark to come back by. The mark also asks
 *               the browser for fullscreen (the Fullscreen API — a phone's only
 *               route to it, F11's on a laptop) and gives it back on the
 *               way out, but only a fullscreen it entered itself: one the
 *               host or the user already had is left alone, and leaving by
 *               Esc or the back gesture leaves the strips as they were.
 *
 * The edge grips the frame first shipped with — a title grip and a playback
 * grip, each strip drawn out and put away on its own — were retired on
 * 2026-09-15 for the one mark: the strips no longer have a reduced form.
 *
 * Below ~1000px of pane the tools row wraps to its stacked form; a phone and
 * the workbench's pane beside its rail and side panel both hit it. Below 560px
 * an open pad stops hanging from its button and spans the strip instead — see
 * the narrow pose beside `.popover`.
 *
 * ONE ELEMENT, TWO HOSTS. Studio mounts it on the piece page; the workbench on
 * the scenario page's score pane. Every value the frame shows comes in as a
 * property and every change leaves as the pads' own events (`view-change`,
 * `display-change`, `unrolled-change`, `zoom-change`, `spacing-mode-change`),
 * which bubble composed through the frame for the host to store — the pads
 * are chrome, not surface, and so
 * is this — `theme-change` included, on the one row of the card that is about
 * the shell rather than the document. Focus follows the same rule: `focused` is a property the host may
 * set (studio's remembered choice; the workbench's document focus), and every
 * toggle from the mark leaves as `focus-change` (detail: the new boolean) for
 * the host to remember or ignore. Which pad is up stays the frame's own — a
 * popover is not a preference. The video divider is the same again: its place,
 * as a percentage of the frame's width, comes in as `videoDividerPercent`, and
 * every drag (on release) or arrow-key step leaves as `video-divider-change`
 * (detail: the new percentage).
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
  /** The shell's light/dark setting, when the host wants the settings card to
   *  carry it. Null leaves the row out — see `SettingsPad.theme`. The frame
   *  only ferries it: the choice leaves as `theme-change` like every other. */
  @property() theme: 'auto' | 'light' | 'dark' | null = null;

  /** The zoom pad's inputs — see ZoomPad for each. */
  @property({ type: Number }) staffSp: number | null = DEFAULT_STAFF_SP;
  @property({ type: Number }) densityH: number | null = DEFAULT_SPACE_SP;
  @property() spacingMode: 'natural' | 'fill' = DEFAULT_SPACING_MODE;
  @property({ type: Number }) effectiveStaffSp = 1;
  @property({ attribute: false }) densitySteps: (() => number[] | null) | null = null;

  /** Whether Zoom and Settings are offered at all — a score still loading, or one
   *  the host cannot lay out, has nothing for them to change. */
  @property({ type: Boolean }) pads = true;

  /** Whether the strips are hidden — the host's to pin (see the note above). */
  @property({ type: Boolean, reflect: true }) focused = false;
  /** A shortcut the host binds to the same toggle, printed in the mark's tooltip. */
  @property({ attribute: 'focus-shortcut' }) focusShortcut = '';
  /** True while the mark's own focusing holds the browser fullscreen. */
  private ownsFullscreen = false;
  /** Where the video divider sits, as a percentage of the frame's width —
   *  the host's to restore. Null keeps the default pane width. */
  @property({ type: Number, attribute: 'video-divider-percent' }) videoDividerPercent: number | null = null;
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
  /** A placed divider is a proportion, so the pane keeps its share of a window
   *  resized under it; the width follows once the frame has one. */
  private fitVideo() {
    const percent = this.videoDividerPercent;
    if (percent !== null && Number.isFinite(percent) && this.clientWidth > 0) this.resizeVideo(this.clientWidth * percent / 100);
    else this.resizeVideo(this.videoWidth);
  }
  /** The divider was put somewhere: hold it there as a share, and tell the host. */
  private placeVideo(width: number) {
    this.resizeVideo(width);
    if (this.clientWidth <= 0) return;
    this.videoDividerPercent = Math.round(this.videoWidth / this.clientWidth * 1000) / 10;
    this.dispatchEvent(new CustomEvent<number>('video-divider-change', { detail: this.videoDividerPercent, bubbles: true, composed: true }));
  }
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
      this.placeVideo(this.videoWidth);
    };
    divider.addEventListener('pointermove', move);
    divider.addEventListener('lostpointercapture', end);
  };
  private readonly resizeVideoKey = (event: KeyboardEvent) => {
    const width = event.key === 'Home' ? 200 : event.key === 'End' ? this.videoMaximum
      : event.key === 'ArrowLeft' ? this.videoWidth - 20 : event.key === 'ArrowRight' ? this.videoWidth + 20 : null;
    if (width === null) return;
    event.preventDefault(); this.placeVideo(width);
  };
  @state() private pad: Pad = null;
  @state() private progress = 0;
  @state() private hasPerformance = false;
  @state() private playing = false;

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

      /* ── focus controls ──
         The focus toggle sits inside the pane's top-right corner rather than
         clipping its canvas edge. In focus mode, playback joins it on the
         left because the normal player tray is parked. The frame measures
         the slotted scroller's bar and sets --score-scrollbar, keeping this
         group clear of it. */
      .focus-controls {
        position: absolute;
        top: 3px;
        right: calc(var(--score-scrollbar, 0px) + 3px);
        z-index: 3;
        display: flex;
        gap: 3px;
        opacity: 0.3;
        transition: opacity 0.12s ease;
      }

      .focus-controls:hover,
      .focus-controls:focus-within {
        opacity: 1;
      }

      .focus-mark,
      .focus-play {
        display: grid;
        place-items: center;
        width: 40px;
        height: 36px;
        padding: 0;
        box-sizing: border-box;
        background: var(--frame-bar);
        border: 1px solid var(--line);
        border-radius: var(--frame-radius);
        backdrop-filter: blur(6px);
        /* The group already has a deliberate 3px canvas inset. A drop shadow
           painted through that inset and made the controls visually touch the
           edge even though their border box was correctly placed. */
        box-shadow: none;
        color: var(--ink);
        cursor: pointer;
      }

      .focus-play:disabled {
        cursor: default;
        opacity: 0.4;
      }

      @media (prefers-reduced-motion: reduce) {
        .focus-controls {
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

      /* Wide: the two groups are transparent and everything sits in one row;
         the row does not wrap, so a title that runs out of room ellipsizes
         instead of pushing the tools onto a line of their own. Narrow: two
         rows — the way back, the tools and the menu share the first, the head
         has the second to itself. A host whose tools will not fit beside its
         way back gets them on a line of their own (the tools row wraps as one
         item), so nothing is ever clipped off the pane. The breakpoint is
         where a studio title and artist of ordinary length still fit whole
         beside five tools; lower, the one row squeezes a title it could have
         shown. It was 1000px, which stacked three rows while one still fitted. */
      .strip.top {
        flex-wrap: nowrap;
      }

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
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--ink-3);
        font-size: 13px;
        white-space: nowrap;
      }

      /* Faint until wanted: the mark is always there, so it never has to be
         found, and never competes with the title it sits beside. Smaller and
         quieter than a tools-row button, which is the point — it belongs to the
         title, not to the row of things you do to the score. */
      .head ::slotted([slot='title-action']) {
        align-self: center;
        flex: none;
        width: 32px;
        height: 32px;
        padding: 0;
        border-color: transparent;
        color: var(--ink-3);
        opacity: 0.55;
        transition: opacity 120ms ease;
      }

      .head ::slotted([slot='title-action']:hover) {
        border-color: var(--line);
        color: var(--ink);
      }

      .head:hover ::slotted([slot='title-action']),
      .head ::slotted([slot='title-action']:focus),
      .head ::slotted([slot='title-action'][aria-expanded='true']) {
        opacity: 1;
      }

      .head ::slotted([slot='title-action'][aria-expanded='true']) {
        border-color: var(--line);
        background: var(--frame-ground);
        color: var(--ink);
      }

      .spacer {
        flex: 1;
      }

      .end {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      @container (max-width: 820px) {
        .strip.top {
          flex-wrap: wrap;
        }

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
          flex: 1 1 auto;
          order: 1;
          /* A host's actions are its own business and may outnumber the width:
             wrap them rather than clip the last one off the pane. */
          flex-wrap: wrap;
        }

        .strip.top .spacer {
          display: none;
        }

        .tools-row .spacer {
          display: block;
        }

        /* The menu joins the first row after the tools. The group dissolves so
           an empty menu is no item at all: an empty box and its gap would
           spill onto a line of their own on a phone. */
        .end {
          display: contents;
        }

        ::slotted([slot='menu']) {
          order: 1;
        }
      }

      /* A phone: the title steps down a size, then the subheading goes and the
         title keeps the line. A host's way back can drop its word at the same
         width — the frame is the container its slotted link queries. */
      @container (max-width: 480px) {
        .head h1 {
          font-size: 1.2rem;
        }
      }

      @container (max-width: 360px) {
        .head .sub {
          display: none;
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

      /* The tools row is icons alone; the tooltip carries the word. A host's
         actions opt in with class="icon". */
      .btn.icon,
      ::slotted(.icon) {
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

      .btn:focus-visible {
        outline: var(--rule-w) solid var(--focus-ring);
        outline-offset: 2px;
      }

      .focus-mark:focus-visible,
      .focus-play:focus-visible {
        outline: var(--rule-w) solid var(--focus-ring);
        outline-offset: -3px;
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
        /* The ceiling a pad sizes itself under. The pads are max-content and
           know nothing about the strip they were docked into, so the frame —
           the element that IS the container — says how much room there is. */
        --pad-max-width: calc(100cqw - 16px);
      }

      /* ── the pad's narrow pose ──
         A pad hangs from its button's right edge and opens leftward. In the
         stacked tools row the spacer pushes the buttons right, so how much
         room a pad has is set by the host's actions beside it, not by the
         frame: on a phone the settings card wants ~300px and gets ~245px, and
         the difference walked off the LEFT EDGE of the screen, taking the
         first column of every row label with it. (The card's own clamp could
         not catch it: 100vw is the right measurement in the corner pose it
         was cut for, where the card hangs off the pane's corner, and the wrong
         one under a button mid-strip.)
         Below the width where that can happen, the pad stops hanging from its
         button and hangs from the STRIP: the anchor gives up being the
         containing block, and the popover spans the strip between the gutters.
         "top" still resolves to just under the row, the score below stays
         visible — which is the whole point of a card you watch the score
         through — and the click-away path is untouched, because the popover is
         still the anchor's child in the DOM. */
      @container (max-width: 560px) {
        .anchor {
          position: static;
        }

        .popover {
          left: 8px;
          right: 8px;
        }
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
    this.playing = detail.playing ?? false;
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
    this.fitVideo();
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
    this.videoObserver = new ResizeObserver(() => { this.fitVideo(); this.requestUpdate(); });
    this.videoObserver.observe(this);
    this.scrollerObserver = new ResizeObserver(entries => this.measureScrollbar(entries.map(entry => entry.target)));
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
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
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
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

  /** Browser fullscreen follows the mark: in with focus, out with unfocus.
   *  It must be asked for inside the tap itself (user activation), so this
   *  runs from the mark's click and not from the `focused` property — the
   *  host's shortcut and remembered choice never touch the browser. */
  private syncFullscreen(focused: boolean) {
    if (focused) {
      if (document.fullscreenElement) return; // the host's or the user's — not ours to leave
      const root = document.documentElement;
      if (typeof root.requestFullscreen !== 'function') return;
      root.requestFullscreen({ navigationUI: 'hide' }).then(
        () => { this.ownsFullscreen = true; },
        () => { /* refused (no activation, iframe policy): the strips still went */ },
      );
    } else if (this.ownsFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  private readonly onFullscreenChange = () => {
    if (!document.fullscreenElement) this.ownsFullscreen = false;
  };

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
    if (changed.has('videoDividerPercent')) this.fitVideo();
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
  private static get play() { return ScoreFrame.glyph('M8 5l11 7-11 7z', 18); }
  private static get pause() { return ScoreFrame.glyph('M7 5h3.5v14H7zM13.5 5H17v14h-3.5z', 18); }

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
    const playbackLabel = this.playing ? 'Pause' : 'Play';
    return html`<div class="focus-controls">
      ${this.focused ? html`<button
        class="focus-play"
        type="button"
        ?disabled=${!this.hasPerformance}
        aria-label=${playbackLabel}
        aria-pressed=${this.playing}
        title=${playbackLabel}
        @click=${() => this.player?.toggle()}
      >${this.playing ? ScoreFrame.pause : ScoreFrame.play}</button>` : nothing}
      <button
        class="focus-mark"
        type="button"
        aria-pressed=${this.focused}
        aria-label=${label}
        title=${this.focusShortcut ? `${label} (${this.focusShortcut})` : label}
        @click=${(event: MouseEvent) => {
          const focused = !this.focused;
          this.setFocused(focused);
          this.syncFullscreen(focused);
          // A pointer leaves the mark unfocused: the next keypress (space to
          // play, arrows to scroll) would otherwise light its ring and leave
          // it lit. Keyboard activation (detail 0) keeps focus where it is.
          if (event.detail > 0) (event.currentTarget as HTMLElement).blur();
        }}
      >${this.focused ? ScoreFrame.focusOut : ScoreFrame.focusIn}</button>
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
          <!-- Beside the words it edits: a host action ON the title, as opposed
               to the tools row, which is what you DO to the score. Empty in
               every host that supplies nothing. -->
          <slot name="title-action"></slot>
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
                <button class="btn icon ${this.pad === 'zoom' ? 'on' : ''}" type="button" aria-label="Zoom" title="Zoom" aria-expanded=${this.pad === 'zoom'} @click=${() => this.togglePad('zoom')}>
                  ${ScoreFrame.crosshair}
                </button>
                ${this.pad === 'zoom'
                  ? html`<div class="popover">
                      <mnx-zoom-pad
                        pinned
                        .staffSp=${this.staffSp}
                        .densityH=${this.densityH}
                        .spacingMode=${this.spacingMode}
                        .densitySteps=${this.densitySteps}
                        .effectiveStaffSp=${this.effectiveStaffSp}
                      ></mnx-zoom-pad>
                    </div>`
                  : nothing}
              </div>
              <div class="anchor">
                <button class="btn icon ${this.pad === 'settings' ? 'on' : ''}" type="button" aria-label="Settings" title="Settings" aria-expanded=${this.pad === 'settings'} @click=${() => this.togglePad('settings')}>
                  ${ScoreFrame.gear}
                </button>
                ${this.pad === 'settings'
                  ? html`<div class="popover">
                      <mnx-settings-pad
                        pinned
                        .display=${this.display}
                        .view=${this.view}
                        .views=${this.views}
                        .unrolled=${this.unrolled}
                        .spacingMode=${this.spacingMode}
                        .theme=${this.theme}
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
