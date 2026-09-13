import { LitElement, html, css, svg, nothing } from 'lit';
import { designTokens } from './tokens.ts';
import { customElement, property, state } from 'lit/decorators.js';
import type { Performance } from '../audio/performanceTypes.ts';
import {
  Transport,
  type TransportEvent,
  type TransportSnapshot,
  type LoopRegion,
} from '../audio/transport.ts';
import {
  SAMPLE_PRESETS,
  isSamplePreset,
  type SamplePreset,
  type VoicePreset,
} from '../audio/sampleSelection.ts';
import type { SamplePackLoader } from '../audio/native/samplePacks.ts';
import { NativeSink, nativeClock } from '../audio/native/sink.ts';
import { formatPlaybackPosition, measureAt, passesOf, playbackPositionParts, widestPlaybackPosition } from '../audio/playbackPosition.ts';
import { ZERO, compare, type Rational } from '../audio/time.ts';
import type { MnxStructure } from '../model/mnx.ts';
import type { PlaybackUpdate } from './mnxContext.ts';

@customElement('mnx-player')
export class Player extends LitElement {
  @property({ attribute: false }) performance: Performance | null = null;
  @property({ attribute: false }) document: MnxStructure | undefined;
  @property({ type: String }) documentId = '';
  @property({ attribute: 'voice-preset' }) voicePreset: VoicePreset = 'synth';
  @property({ attribute: 'sample-base' }) sampleBase: string | undefined;
  @property({ attribute: false }) sampleBases: Partial<Record<SamplePreset, string>> | undefined;
  @property({ attribute: false }) sampleLoader: SamplePackLoader | undefined;
  @state() private loading = false;
  @property({ type: Number }) initialOrdinal: number | null = null;
  @state() private status: TransportSnapshot | undefined;
  @state() private error = '';
  @state() private rate = 1;
  /** YouTube's range: 0.25× to 2× on a 0.05 grid; the slider snaps to it. */
  static readonly RATE_MIN = 0.25;
  static readonly RATE_MAX = 2;
  static readonly RATE_STEP = 0.05;
  @state() private volume = 0.7;
  private transport?: Transport;
  private sink?: NativeSink;
  private revision = 0;
  private playRequest = 0;
  private lastUpdate = '';
  private lastOrdinal: number | null = null;
  /**
   * The tray, in the library page's vocabulary (roadmap/inprogress/core-score-frame.md,
   * 2026-09-12): the shared tokens, 40px controls so the tray is catchable on
   * glass, the transport as glyphs on the accent, and a scrubber over the
   * performed order. The order table is gone: the readout says which pass
   * this is of how many, and on a repeated bar that iteration opens a menu
   * of the passes — the frame the tray lives in is a strip over the score,
   * not a panel beside it.
   */
  static styles = [
    designTokens,
    css`
    :host {
      display: block;
      font: 14px/1.4 var(--sans);
      color: var(--ink);
      --player-ground: light-dark(oklch(0.9 0.004 60), oklch(0.26 0.006 60));
    }
    .controls {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    button,
    select,
    input {
      font: inherit;
      color: inherit;
      accent-color: var(--accent);
    }
    button,
    select,
    label.select {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 40px;
      box-sizing: border-box;
      background: transparent;
      border: 1px solid var(--line);
      border-radius: 3px;
      padding: 0 12px;
      cursor: pointer;
      white-space: nowrap;
    }
    button:hover:not(:disabled) {
      border-color: var(--ink-3);
    }
    button.icon {
      width: 40px;
      padding: 0;
      justify-content: center;
    }
    button.primary {
      width: 48px;
      height: 48px;
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    button:disabled {
      opacity: 0.4;
      cursor: default;
    }
    button:focus-visible,
    select:focus-visible,
    input:focus-visible {
      outline: var(--rule-w) solid var(--focus-ring);
      outline-offset: 2px;
    }
    label.select {
      padding: 0 4px 0 12px;
      color: var(--ink-3);
    }
    label.select select {
      border: 0;
      padding: 0 4px;
      height: 100%;
      color: var(--ink);
    }
    /* The readout is sized by the widest label the performance can print
       (stacked under it, invisible) so the scrubber beside it never moves
       as the beat ticks from 4 to 4.5. */
    output {
      display: inline-grid;
      font: 500 13px/1 var(--mono);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    output > span {
      grid-area: 1 / 1;
    }
    output > .widest {
      visibility: hidden;
    }
    output.none {
      font: inherit;
      color: var(--ink-3);
    }
    .scrub {
      flex: 1 1 160px;
      min-width: 120px;
      height: 40px;
      margin: 0;
    }
    label.volume,
    label.rate {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--ink-3);
    }
    label.volume input {
      width: 110px;
    }
    label.rate input {
      width: 120px;
    }
    /* Two decimals always, so 1.00× and 0.25× are the same width and the
       volume beside it holds still. */
    label.rate output {
      display: inline;
      color: var(--ink);
      min-width: 5ch;
    }
    /* The iteration in the readout is a control on a repeated bar: a dotted
       word that opens a menu of the bar's passes above the tray — the verses
       — each seeking to that pass. The invisible widest copy carries the
       same caret so the reserved width still matches. */
    .passes {
      position: relative;
      display: inline;
    }
    .passes > button {
      display: inline;
      height: auto;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: none;
      font: inherit;
      color: inherit;
      text-decoration: underline dotted;
      text-underline-offset: 3px;
    }
    .passes > button:hover,
    .passes > button[aria-expanded='true'] {
      color: var(--accent);
    }
    .caret {
      display: inline-block;
      width: 12px;
      height: 12px;
      vertical-align: -2px;
      margin-left: 2px;
    }
    .pass-menu {
      position: absolute;
      bottom: calc(100% + 10px);
      left: 0;
      z-index: 5;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 150px;
      max-height: 240px;
      overflow: auto;
      padding: 4px;
      box-sizing: border-box;
      background: var(--player-ground);
      border: 1px solid var(--line);
      border-radius: 3px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18), 0 6px 18px rgba(0, 0, 0, 0.22);
    }
    .pass-menu button {
      height: 32px;
      padding: 0 10px;
      border: 0;
      border-radius: 3px;
      justify-content: flex-start;
      font: 500 13px/1 var(--mono);
      font-variant-numeric: tabular-nums;
    }
    .pass-menu button:hover {
      background: light-dark(rgba(0, 0, 0, 0.06), rgba(255, 255, 255, 0.08));
    }
    .pass-menu button[aria-current='true'] {
      color: var(--accent);
    }
    th {
      color: var(--ink-3);
      font-weight: 400;
      font-size: 12px;
    }
    tr[aria-current='true'] {
      background: var(--row-current);
    }
    td button {
      width: 100%;
      height: 36px;
      text-align: left;
      border: 0;
      padding: 0 4px;
    }
    p {
      margin: 8px 0 0;
      color: var(--ink-2);
    }
  `
  ];
  /** Whether the passes menu is open; it closes on a pick, click-away or Escape. */
  @state() private passesOpen = false;
  private readonly onClickAway = (event: PointerEvent) => {
    if (!this.passesOpen) return;
    const inside = event.composedPath().some((n) => n instanceof HTMLElement && n.classList.contains('passes'));
    if (!inside) this.passesOpen = false;
  };
  private readonly onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.passesOpen) {
      this.passesOpen = false;
      event.stopPropagation();
    }
  };
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('pointerdown', this.onClickAway);
    this.addEventListener('keydown', this.onKeydown);
    try {
      this.rate = Number(localStorage.getItem('mnx-player-rate')) || 1;
      this.volume = Number(localStorage.getItem('mnx-player-volume') ?? 0.7);
    } catch {}
    this.rate = Player.snapRate(this.rate);
    this.volume = Number.isFinite(this.volume) ? Math.min(1, Math.max(0, this.volume)) : 0.7;
    if (this.hasUpdated) this.install();
  }
  disconnectedCallback() {
    document.removeEventListener('pointerdown', this.onClickAway);
    this.removeEventListener('keydown', this.onKeydown);
    this.teardown();
    super.disconnectedCallback();
  }
  /** The widest readout label, refreshed only when the performance changes. */
  private widest = '';

  protected willUpdate(changed: Map<PropertyKey, unknown>) {
    if (changed.has('performance') || changed.has('document'))
      this.widest = this.performance ? widestPlaybackPosition(this.performance, this.document) : '';
  }

  protected updated(changed: Map<PropertyKey, unknown>) {
    const reinstall =
      changed.has('performance') ||
      changed.has('documentId') ||
      changed.has('sampleBase') ||
      changed.has('sampleBases') ||
      changed.has('sampleLoader');
    if (reinstall) {
      this.install();
      if (this.initialOrdinal !== null) this.seek(this.initialOrdinal);
      // A performance arriving or leaving is a fact the chrome around the
      // player needs (the score frame's grip enables on it), and the state
      // frame it would ride on is deduplicated away when nothing else moved.
      this.dispatchEvent(
        new CustomEvent('performance-changed', {
          detail: { documentId: this.documentId, available: this.performance !== null },
          bubbles: true,
          composed: true,
        }),
      );
    } else if (changed.has('initialOrdinal') && this.initialOrdinal !== null)
      this.seek(this.initialOrdinal);
    if (!reinstall && changed.has('voicePreset') && this.sink) {
      const resume = this.status?.state === 'playing' || this.loading;
      this.pause();
      this.sink.setVoicePreset(this.sinkPreset(), this.requiredSamples());
      this.error = '';
      if (resume) void this.play();
    }
  }
  private publish() {
    const ordinal =
      this.status &&
      this.performance &&
      (this.status.state !== 'stopped' || this.status.activeWritten.length > 0)
        ? (measureAt(this.performance, this.status.position)?.ordinal ?? null)
        : null;
    const highlight =
      this.status?.activeWritten.map((w) => ({ noteKey: w.noteKey, ordinal: w.ordinal })) ?? [];
    const detail: PlaybackUpdate = {
      documentId: this.documentId,
      ordinal,
      highlight,
      playing: this.status?.state === 'playing',
    };
    const signature = JSON.stringify(detail);
    if (signature === this.lastUpdate) return;
    this.lastUpdate = signature;
    this.dispatchEvent(
      new CustomEvent('playback-state-changed', { detail, bubbles: true, composed: true }),
    );
    if (ordinal !== this.lastOrdinal) {
      this.lastOrdinal = ordinal;
      this.dispatchEvent(
        new CustomEvent('bar', {
          detail: { documentId: this.documentId, ordinal },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }
  private teardown() {
    this.revision++;
    this.transport?.dispose();
    this.transport = undefined;
    this.sink?.dispose();
    this.sink = undefined;
    this.status = undefined;
    this.loading = false;
    this.lastOrdinal = null;
    this.publish();
  }
  private sinkPreset(): 'synth' | ((voice: string) => VoicePreset) {
    if (!isSamplePreset(this.voicePreset)) return 'synth';
    const kits = new Set(this.performance?.voices.filter((v) => v.kit).map((v) => v.id));
    const preset = this.voicePreset;
    return (voice: string) => (kits.has(voice) ? 'synth' : preset);
  }
  private requiredSamples(): SamplePreset[] {
    return isSamplePreset(this.voicePreset) ? [this.voicePreset] : [];
  }
  private install() {
    this.teardown();
    this.error = '';
    if (!this.performance || !this.isConnected) return;
    const revision = this.revision;
    const sink = new NativeSink({
      volume: this.volume,
      voicePreset: this.sinkPreset(),
      sampleBase: this.sampleBase,
      sampleBases: this.sampleBases,
      samplePresets: this.requiredSamples(),
      sampleLoader: this.sampleLoader,
    });
    this.sink = sink;
    this.transport = new Transport(this.performance, nativeClock(sink), sink, {
      onEvent: (event: TransportEvent) => {
        if (revision !== this.revision) return;
        if (event.kind === 'state') {
          this.status = event.snapshot;
          this.publish();
        } else if (event.kind === 'onset')
          this.dispatchEvent(
            new CustomEvent('onset', {
              detail: { ...event, documentId: this.documentId },
              bubbles: true,
              composed: true,
            }),
          );
      },
    });
    if (this.rate !== 1) this.transport.setRate(this.rate);
    this.status = undefined;
    this.publish();
  }
  get snapshot() {
    return this.status;
  }
  get position(): Rational {
    return this.transport?.position ?? ZERO;
  }
  async play() {
    if (!this.transport) return;
    const revision = this.revision;
    const request = ++this.playRequest;
    if (
      this.status?.state === 'stopped' &&
      compare(this.status.position, this.transport.duration) >= 0
    )
      this.transport.seek(ZERO);
    this.error = '';
    this.loading = true;
    try {
      await this.transport.play();
    } catch (e) {
      if (revision === this.revision && request === this.playRequest)
        this.error = e instanceof Error ? e.message : String(e);
    } finally {
      if (revision === this.revision && request === this.playRequest) this.loading = false;
    }
  }
  pause() {
    this.playRequest++;
    this.loading = false;
    this.transport?.pause();
  }
  stop() {
    this.playRequest++;
    this.loading = false;
    this.transport?.stop();
  }
  /** Play/pause as ONE verb, for callers that have no view of the state — the
   *  two-finger tap gesture, and any host key binding. The button in `render()`
   *  keeps its own branch because it also prints which it is about to do. */
  toggle() {
    if (this.status?.state === 'playing') this.pause();
    else void this.play();
  }
  seek(ordinal: number) {
    const measure = this.performance?.measures.find((m) => m.ordinal === ordinal);
    if (!measure || !this.transport) return false;
    this.transport.seek(measure.position);
    this.dispatchEvent(
      new CustomEvent('seek', {
        detail: { documentId: this.documentId, ordinal },
        bubbles: true,
        composed: true,
      }),
    );
    return true;
  }
  setLoop(loop?: LoopRegion) {
    this.transport?.setLoop(loop);
  }
  /** Clamp to the slider's range and land on its 0.05 grid, so a stored or
   *  dragged value never carries float noise into the readout. */
  static snapRate(value: number): number {
    if (!Number.isFinite(value)) return 1;
    const clamped = Math.min(Player.RATE_MAX, Math.max(Player.RATE_MIN, value));
    // Divide by the grid's reciprocal: 23 / 20 is the double nearest 1.15,
    // where 23 * 0.05 is not.
    const perUnit = Math.round(1 / Player.RATE_STEP);
    return Math.round(clamped * perUnit) / perUnit;
  }
  private changeRate(event: Event) {
    this.rate = Player.snapRate(Number((event.target as HTMLInputElement).value));
    this.transport?.setRate(this.rate);
    try {
      localStorage.setItem('mnx-player-rate', String(this.rate));
    } catch {}
  }
  private resetRate() {
    this.rate = 1;
    this.transport?.setRate(1);
    try {
      localStorage.setItem('mnx-player-rate', '1');
    } catch {}
  }
  private changeVolume(event: Event) {
    this.volume = Number((event.target as HTMLInputElement).value);
    this.sink?.setVolume(this.volume);
    try {
      localStorage.setItem('mnx-player-volume', String(this.volume));
    } catch {}
  }
  private static glyph(d: string, px = 22) {
    return svg`<svg width=${px} height=${px} viewBox="0 0 24 24" aria-hidden="true"><path d=${d} fill="currentColor"></path></svg>`;
  }

  private static caret() {
    return svg`<svg class="caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5z" fill="currentColor"></path></svg>`;
  }
  /** The live readout: the iteration becomes a menu of the bar's passes when it has more than one. */
  private readout() {
    if (!this.performance) return nothing;
    const parts = playbackPositionParts(this.performance, this.position, this.document);
    if (!parts) return formatPlaybackPosition(this.performance, this.position, this.document);
    const passes = passesOf(this.performance, parts.measureIndex);
    const iteration = `iteration ${parts.iteration} of ${parts.iterations}`;
    const tail = ` · beat ${parts.beat}${parts.insertion ? ` · ${parts.insertion}` : ''}`;
    if (passes.length < 2) return `bar ${parts.bar} · ${iteration}${tail}`;
    return html`bar ${parts.bar} · <span class="passes"
        ><button
          type="button"
          aria-haspopup="menu"
          aria-expanded=${this.passesOpen}
          title="Choose which pass of this bar to play"
          @click=${() => (this.passesOpen = !this.passesOpen)}
        >${iteration}${Player.caret()}</button
        >${this.passesOpen
          ? html`<div class="pass-menu" role="menu" aria-label="Passes of this bar">
              ${passes.map(
                (m) => html`<button
                  type="button"
                  role="menuitem"
                  aria-current=${m.ordinal === parts.ordinal}
                  @click=${() => {
                    this.passesOpen = false;
                    this.seek(m.ordinal);
                  }}
                >iteration ${m.iteration}</button>`,
              )}
            </div>`
          : nothing}</span
      >${tail}`;
  }
  private onScrub(event: Event) {
    this.seek(Number((event.target as HTMLInputElement).value));
  }

  render() {
    const playing = this.status?.state === 'playing';
    const count = this.performance?.measures.length ?? 0;
    return html` <div class="controls">
        <button
          class="primary"
          ?disabled=${!this.performance || this.loading}
          aria-label=${this.loading ? 'Loading' : playing ? 'Pause' : 'Play'}
          title=${this.loading ? 'Loading…' : playing ? 'Pause' : 'Play'}
          @click=${() => (playing ? this.pause() : void this.play())}
        >
          ${playing ? Player.glyph('M7 5h3.5v14H7zM13.5 5H17v14h-3.5z') : Player.glyph('M8 5l11 7-11 7z')}
        </button>
        <button class="icon" ?disabled=${!this.performance} aria-label="Stop" title="Stop" @click=${() => this.stop()}>
          ${Player.glyph('M6 6h12v12H6z', 18)}
        </button>
        <output aria-live="off" class=${this.performance ? '' : 'none'}
          >${this.performance
            ? html`<span>${this.readout()}</span
                ><span class="widest" aria-hidden="true">${this.widest}${Player.caret()}</span>`
            : 'No performance available'}</output
        >
        ${count > 1
          ? html`<input
              class="scrub"
              type="range"
              min="0"
              max=${count - 1}
              step="1"
              aria-label="Position"
              .value=${String(this.lastOrdinal ?? 0)}
              @input=${this.onScrub}
            />`
          : nothing}
        <label class="select"
          >Sound<select
            aria-label="Playback sound"
            .value=${this.voicePreset}
            @change=${(event: Event) => {
              this.voicePreset = (event.target as HTMLSelectElement).value as VoicePreset;
            }}
          >
            <option value="synth" ?selected=${this.voicePreset === 'synth'}>Synth</option>
            ${SAMPLE_PRESETS.map(
              (p) =>
                html`<option value=${p.id} ?selected=${this.voicePreset === p.id}>
                  ${p.label}
                </option>`,
            )}
          </select></label
        >
        <label class="rate" title="Playback rate — double-click for 1×"
          >Rate<input
            aria-label="Playback rate"
            type="range"
            min=${Player.RATE_MIN}
            max=${Player.RATE_MAX}
            step=${Player.RATE_STEP}
            .value=${String(this.rate)}
            @input=${this.changeRate}
            @dblclick=${this.resetRate}
          /><output aria-live="off">${this.rate.toFixed(2)}×</output></label
        >
        <label class="volume" title="Volume">
          ${Player.glyph('M4 9v6h4l5 4V5L8 9z', 18)}<input
            aria-label="Volume"
            type="range"
            min="0"
            max="1"
            step=".05"
            .value=${String(this.volume)}
            @input=${this.changeVolume}
        /></label>
      </div>
      ${this.loading
        ? html`<p role="status">
            Preparing ${isSamplePreset(this.voicePreset) ? 'guitar samples' : 'audio'}…
          </p>`
        : nothing}
      ${this.error ? html`<p role="alert">Playback unavailable: ${this.error}</p>` : nothing}`;
  }
}
