import { LitElement, html, css, svg, nothing } from 'lit';
import { designTokens } from './tokens.ts';
import { customElement, property, state } from 'lit/decorators.js';
import type { Performance } from '../audio/performanceTypes.ts';
import type { LoopRegion } from '../audio/transport.ts';
import { PlaybackSession, type PlaybackSnapshot } from '../audio/playbackSession.ts';
import { type RecordingSource, type PlaybackBackend, type ScorePosition, type ScoreLoop } from '../audio/playbackBackend.ts';
import { RecordingBackend } from '../audio/recordingBackend.ts';
import { NativeYouTubePort } from '../audio/native/youtube.ts';
import { youtubeVideoId } from '../audio/youtubeUrl.ts';
import { HtmlAudioPort } from '../audio/native/htmlAudio.ts';
import { SynthBackend } from '../audio/native/synthBackend.ts';
import { createRecordingSync } from '../audio/recordingSync.ts';
import { scorePositionAt } from '../audio/scorePosition.ts';
import { linearizePasses } from '../model/passes.ts';
import {
  SAMPLE_PRESETS,
  isSamplePreset,
  type SamplePreset,
  type VoicePreset,
} from '../audio/sampleSelection.ts';
import type { SamplePackLoader } from '../audio/native/samplePacks.ts';
import { formatPlaybackPosition, formatScorePlaybackPosition, measureAt, passLabel, passesOf, placeLabel, playbackPositionParts, scorePlaybackPositionParts, widestPlaceLabel, widestPlaybackPosition, type PlaybackPositionParts } from '../audio/playbackPosition.ts';
import { ZERO, type Rational } from '../audio/time.ts';
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
  @property({ attribute: false }) writtenBarDurations: readonly Rational[] | undefined;
  @property({ attribute: false }) recordings: readonly RecordingSource[] = [];
  private get loading() { return this.status?.loading ?? false; }
  @property({ type: Number }) initialOrdinal: number | null = null;
  @state() private status: PlaybackSnapshot | undefined;
  @state() private localError = '';
  private get error() { return this.localError || this.status?.issue || ''; }
  @state() private rate = 1;
  /** Default synth/audio controls; other backends advertise their own rates. */
  static readonly RATE_MIN = 0.25;
  static readonly RATE_MAX = 2;
  static readonly RATE_STEP = 0.05;
  @state() private volume = 0.7;
  private session?: PlaybackSession;
  private revision = 0;
  private youtubeAccepted = false;
  @state() private youtubeRequest: string | null = null;
  @state() private youtubeNotice = false;
  private lastUpdate = '';
  private lastOrdinal: number | null = null;
  /**
   * The tray, in the library page's vocabulary (roadmap/inprogress/core-score-frame.md,
   * 2026-09-12): the shared tokens, 40px controls so the tray is catchable on
   * glass, the transport as glyphs on the accent, and a scrubber over the
   * performed order. The order table is gone: the readout says which pass
   * this is of how many, and on a repeated bar that pass opens a menu
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
    .youtube-panel { margin-top: 12px; }
    .youtube-surface { width: min(100%, 480px); min-width: 200px; height: clamp(200px, 56.25vw, 270px); position: relative; z-index: 10; }
    .youtube-panel p { max-width: 60ch; }
    .youtube-panel a { color: inherit; }
    .youtube-notice { max-width: 65ch; }
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
    output > span,
    .place > span {
      grid-area: 1 / 1;
    }
    output > .widest,
    .place > .widest {
      visibility: hidden;
    }
    .place {
      display: inline-grid;
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
    /* The pass in the readout is a control on a repeated bar: a dotted
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
  private widestPlace = '';

  protected willUpdate(changed: Map<PropertyKey, unknown>) {
    if (changed.has('performance') || changed.has('document'))
      this.widest = this.performance ? widestPlaybackPosition(this.performance, this.document) : '';
      this.widestPlace = this.performance ? widestPlaceLabel(this.performance, this.document) : '';
  }

  protected updated(changed: Map<PropertyKey, unknown>) {
    const reinstall =
      changed.has('performance') ||
      changed.has('documentId') ||
      changed.has('document') ||
      changed.has('writtenBarDurations') ||
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
    if (!reinstall && changed.has('recordings') && this.session) {
      const id = this.session.backend.id;
      if (id !== 'synth') void this.selectSource(this.recordings.some(r => r.id === id) ? id : 'synth', true);
    }
    if (!reinstall && changed.has('voicePreset') && this.session?.backend instanceof SynthBackend) {
      const resume = this.playback?.wantsPlayback;
      this.pause();
      this.session.backend.sink.setVoicePreset(this.sinkPreset(), this.requiredSamples());
      this.localError = '';
      if (resume) void this.play();
    }
  }
  private publish() {
    const status = this.status;
    const visible = status && !status.hidePlayhead && (status.state !== 'stopped' || status.highlight.length > 0);
    const current = status?.transport && this.performance ? measureAt(this.performance, status.transport.position)?.ordinal
      : status?.scorePosition?.ordinal;
    const ordinal = visible && current !== undefined && current < (this.performance?.measures.length ?? 0) ? current : null;
    const detail: PlaybackUpdate = { documentId: this.documentId, ordinal, highlight: [...(status?.highlight ?? [])],
      playing: status?.wantsPlayback ?? false };
    this.dispatchEvent(new CustomEvent('playback-position', { detail: {
      documentId: this.documentId, sourceId: status?.sourceId, kind: status?.kind,
      scorePosition: status?.scorePosition ?? null, mediaTime: status?.mediaTime,
    }, bubbles: true, composed: true }));
    const signature = JSON.stringify(detail);
    if (signature !== this.lastUpdate) {
      this.lastUpdate = signature;
      this.dispatchEvent(new CustomEvent('playback-state-changed', { detail, bubbles: true, composed: true }));
    }
    if (ordinal !== this.lastOrdinal) {
      this.lastOrdinal = ordinal;
      this.dispatchEvent(new CustomEvent('bar', { detail: { documentId: this.documentId, ordinal }, bubbles: true, composed: true }));
    }
  }
  private teardown() {
    this.youtubeRequest = null; this.youtubeNotice = false;
    this.revision++;
    this.session?.dispose(); this.session = undefined;
    this.status = undefined; this.lastOrdinal = null; this.publish();
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
    this.teardown(); this.localError = '';
    if (!this.performance || !this.isConnected) return;
    const revision = this.revision, performance = this.performance;
    const factory = (id: string): PlaybackBackend => {
      if (id === 'synth') return new SynthBackend(performance, {
        volume: this.volume, voicePreset: this.sinkPreset(), sampleBase: this.sampleBase,
        sampleBases: this.sampleBases, samplePresets: this.requiredSamples(), sampleLoader: this.sampleLoader,
      }, event => {
        if (revision === this.revision && event.kind === 'onset') this.dispatchEvent(new CustomEvent('onset', {
          detail: { ...event, documentId: this.documentId }, bubbles: true, composed: true,
        }));
      });
      const matches = this.recordings.filter(r => r.id === id);
      if (!id || matches.length !== 1) throw new Error('The selected recording is unavailable or has a duplicate identity.');
      const source = matches[0];
      const sync = this.document && this.writtenBarDurations
        ? createRecordingSync(source.syncpoints, { performance, writtenBarDurations: this.writtenBarDurations }, linearizePasses(this.document)) : null;
      const media = source.kind === 'audio' ? new HtmlAudioPort(source.media) : new NativeYouTubePort(youtubeVideoId(source.video), async () => {
        this.dispatchEvent(new CustomEvent('video-region-changed', { bubbles: true, composed: true }));
        await this.updateComplete;
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        if (revision !== this.revision || this.sourceId !== id) throw new Error('YouTube selection cancelled.');
        const container = this.renderRoot.querySelector<HTMLElement>('.youtube-surface');
        if (!container) throw new Error('Show the YouTube video region before loading.');
        return container;
      });
      return new RecordingBackend(id, media, performance, sync?.ok ? sync.value : null,
        sync && !sync.ok ? sync.diagnostic.message : !sync ? 'Score timing information is unavailable for this recording.' : undefined);
    };
    this.session = new PlaybackSession(factory('synth'), factory, () => {
      if (revision !== this.revision || !this.session) return;
      this.status = this.session.snapshot; this.rate = this.status.rate; this.volume = this.status.volume; this.publish();
    });
    this.session.setRate(this.rate); this.session.setVolume(this.volume);
    this.session.stop();
    this.status = this.session.snapshot; this.publish();
  }
  /** Legacy synth view. Use playback/scorePosition for all source kinds. */
  get snapshot() { return this.session?.snapshot.transport; }
  get position(): Rational { return this.snapshot?.position ?? ZERO; }
  get playback() { return this.session?.snapshot; }
  get scorePosition() { return this.playback?.scorePosition ?? null; }
  get sourceId() { return this.session?.backend.id ?? 'synth'; }
  /** The readout's fields when the position is a place in the score — the
   *  synth's position, or recorded audio inside its sync — else null. */
  get positionParts(): PlaybackPositionParts | null {
    if (!this.performance) return null;
    const status = this.playback;
    if (!status || status.kind === 'synth') return playbackPositionParts(this.performance, this.position, this.document);
    if (status.scorePosition) {
      const parts = scorePlaybackPositionParts(this.performance, status.scorePosition, this.document);
      return parts ? { ...parts, insertion: null } : null;
    }
    return null;
  }
  get positionLabel() {
    if (!this.performance) return 'No performance available';
    const status = this.playback;
    if (!status || status.kind === 'synth') return formatPlaybackPosition(this.performance, this.position, this.document);
    if (status.scorePosition) return formatScorePlaybackPosition(this.performance, status.scorePosition, this.document);
    const time = Math.max(0, status.mediaTime ?? 0);
    return `${status.kind === 'youtube' ? 'YouTube' : 'Audio'} ${Math.floor(time / 60)}:${Math.floor(time % 60).toString().padStart(2, '0')} · outside sync`;
  }
  async selectSource(id: string, replace = false) {
    this.localError = '';
    const source = this.recordings.find(r => r.id === id);
    if (source?.kind === 'youtube' && !this.youtubeAccepted) {
      this.pause(); this.youtubeRequest = id; this.youtubeNotice = true;
      this.dispatchEvent(new CustomEvent('video-region-changed', { bubbles: true, composed: true }));
      return false;
    }
    this.youtubeRequest = null; this.youtubeNotice = false;
    return await this.session?.select(id, replace) ?? false;
  }
  async play() { this.localError = ''; await this.session?.play(); }
  pause() { this.session?.pause(); }
  stop() { this.localError = ''; this.session?.stop(); }
  toggle() { if (this.playback?.wantsPlayback) this.pause(); else void this.play(); }
  private async acceptYouTube() {
    const id = this.youtubeRequest;
    this.youtubeAccepted = true; this.youtubeRequest = null; this.youtubeNotice = false;
    if (id) await this.selectSource(id);
  }
  async startSource() { this.localError = ''; await this.session?.start(); }
  seek(ordinal: number) {
    const measure = this.performance?.measures.find(m => m.ordinal === ordinal);
    if (!measure || !this.session) return false;
    const target = { ordinal, metricOffset: measure.from };
    // An explicit bar click includes the grace/hold at its start. Handoffs
    // deliberately omit this edge because they must not guess within an insertion.
    const edge = this.session.backend instanceof SynthBackend ? 'before' : undefined;
    const problem = this.session.backend.canSeek(target, edge);
    if (problem) { this.localError = problem; return false; }
    void this.session.seek(target, edge);
    this.localError = '';
    this.dispatchEvent(new CustomEvent('seek', { detail: { documentId: this.documentId, ordinal }, bubbles: true, composed: true }));
    return true;
  }
  async seekScorePosition(position: ScorePosition) { this.localError = ''; return await this.session?.seek(position) ?? false; }
  setScoreLoop(loop?: ScoreLoop) { this.session?.setLoop(loop); }
  /** Existing API takes expanded synth positions; media endpoints must map uniquely. */
  setLoop(loop?: LoopRegion) {
    if (!this.session || !this.performance) return;
    if (this.session.backend instanceof SynthBackend) { this.session.backend.transport.setLoop(loop); return; }
    if (!loop) { this.session.setLoop(); return; }
    const start = scorePositionAt(this.performance, loop.start), end = scorePositionAt(this.performance, loop.end);
    if (!start.ok || !end.ok) throw new Error(!start.ok ? start.diagnostic.message : !end.ok ? end.diagnostic.message : 'Invalid loop.');
    this.session.setLoop({ start: start.value, end: end.value });
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
    this.rate = this.session?.setRate(this.rate) ?? this.rate;
    try {
      localStorage.setItem('mnx-player-rate', String(this.rate));
    } catch {}
  }
  private resetRate() {
    this.rate = 1;
    this.rate = this.session?.setRate(1) ?? 1;
    try {
      localStorage.setItem('mnx-player-rate', '1');
    } catch {}
  }
  private changeVolume(event: Event) {
    this.volume = Number((event.target as HTMLInputElement).value);
    this.volume = this.session?.setVolume(this.volume) ?? this.volume;
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
  /** The live readout: the pass becomes a menu of the bar's passes when it has more than one;
   *  a bar played once shows no pass at all. */
  private readout() {
    if (!this.performance) return nothing;
    const parts = this.positionParts;
    if (!parts) return this.positionLabel;
    const passes = passesOf(this.performance, parts.measureIndex);
    const pass = passLabel(parts);
    const tail = parts.insertion ? ` · ${parts.insertion}` : '';
    // The place sits in its own reserved cell so the tenth coming and going
    // never moves the pass beside it.
    const place = html`<span class="place"><span>${placeLabel(parts)}</span><span class="widest" aria-hidden="true">${this.widestPlace}</span></span>`;
    if (!pass) return html`${place}${tail}`;
    if (passes.length < 2) return html`${place} · ${pass}${tail}`;
    return html`${place} · <span class="passes"
        ><button
          type="button"
          aria-haspopup="menu"
          aria-expanded=${this.passesOpen}
          title="Choose which pass of this bar to play"
          @click=${() => (this.passesOpen = !this.passesOpen)}
        >${pass}${Player.caret()}</button
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
                >pass ${m.iteration}</button>`,
              )}
            </div>`
          : nothing}</span
      >${tail}`;
  }
  private onScrub(event: Event) {
    this.seek(Number((event.target as HTMLInputElement).value));
  }

  render() {
    const playing = this.status?.wantsPlayback ?? false;
    const count = this.performance?.measures.length ?? 0;
    return html` <div class="controls">
        <button
          class="primary"
          ?disabled=${!this.performance || this.status?.needsStart}
          aria-label=${playing ? 'Pause' : 'Play'}
          title=${playing ? 'Pause' : 'Play'}
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
              .value=${String(Math.min(count - 1, this.scorePosition?.ordinal ?? this.lastOrdinal ?? 0))}
              @input=${this.onScrub}
            />`
          : nothing}
        ${this.recordings.length ? html`<label class="select">Source<select aria-label="Playback source" ?disabled=${!this.performance}
          .value=${this.sourceId} @change=${(event: Event) => void this.selectSource((event.target as HTMLSelectElement).value)}>
          <option value="synth" ?selected=${this.sourceId === 'synth'}>Synth</option>
          ${this.recordings.map(r => html`<option value=${r.id} ?selected=${this.sourceId === r.id}>${r.name}</option>`)}
        </select></label>` : nothing}
        ${this.sourceId === 'synth' ? html`        <label class="select"
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
` : nothing}
        ${this.status?.kind === 'youtube' ? html`<label class="select">Rate<select aria-label="Playback rate" .value=${String(this.rate)} @change=${this.changeRate}>
          ${(this.status.capabilities.rate.values ?? [1]).map(rate => html`<option value=${String(rate)} ?selected=${rate === this.rate}>${rate}×</option>`)}
        </select></label>` : html`        <label class="rate" title="Playback rate — double-click for 1×"
          >Rate<input
            aria-label="Playback rate"
            type="range"
            min=${this.status?.capabilities.rate.min ?? Player.RATE_MIN}
            max=${this.status?.capabilities.rate.max ?? Player.RATE_MAX}
            step=${this.status?.capabilities.rate.step ?? Player.RATE_STEP}
            .value=${String(this.rate)}
            @input=${this.changeRate}
            @dblclick=${this.resetRate}
          /><output aria-live="off">${this.rate.toFixed(2)}×</output></label
        >`}
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
      ${this.youtubeRequest || this.youtubeNotice ? html`<section class="youtube-notice" aria-label="YouTube terms and privacy">
        <h3>YouTube terms and privacy</h3>
        <p>This player uses YouTube API Services. Loading a video connects your browser to YouTube and Google, which receive your IP address, browser information and this site's origin. YouTube may serve ads and access cookies or similar device storage under the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google Privacy Policy</a>.</p>
        <p>We use playback time and state in memory to follow the score; we do not save them or request YouTube account access. Rate and volume preferences are saved in this browser's localStorage; clearing site data resets them. The host supplies video links and score timings. Studio keeps those in your private library; contact your Studio operator for library deletion. Switching source or leaving the page destroys the video player. Browser privacy controls manage YouTube's cookies.</p>
        <p>By using this YouTube feature you agree to be bound by the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener">YouTube Terms of Service</a>. Select Agree and load to accept these terms and this privacy policy for this player session.</p>
        ${this.youtubeRequest ? html`<button @click=${() => void this.acceptYouTube()}>Agree and load YouTube</button><button @click=${() => { this.youtubeRequest = null; this.youtubeNotice = false; }}>Cancel</button>` : html`<button @click=${() => this.youtubeNotice = false}>Close notice</button>`}
      </section>` : nothing}
      ${this.status?.kind === 'youtube' ? html`<section class="youtube-panel" aria-label="YouTube recording">
        <div class="youtube-surface"></div>
        <p>YouTube · <button @click=${() => this.youtubeNotice = !this.youtubeNotice}>Terms and privacy</button> · <button @click=${() => void this.selectSource('synth')}>Close video</button></p>
      </section>` : nothing}
      ${this.loading
        ? html`<p role="status">
            Preparing ${this.sourceId === 'synth' && isSamplePreset(this.voicePreset) ? 'samples' : 'audio'}…
          </p>`
        : nothing}
      ${this.error ? html`<p role="alert">Playback unavailable: ${this.error}</p>` : nothing}
      ${this.status?.kind === 'youtube' && this.status.error ? html`<button @click=${() => void this.selectSource(this.sourceId, true)}>Retry video</button>` : this.status?.needsStart ? html`<button @click=${() => void this.startSource()}>Start this source</button>` : nothing}
      ${!this.loading && this.status?.state === 'buffering' ? html`<p role="status">Buffering audio…</p>` : nothing}
      ${this.status?.kind !== 'synth' && this.status?.syncIssue && !this.error ? html`<p role="status">Score follow: ${this.status.syncIssue}</p>` : nothing}`;
  }
}
