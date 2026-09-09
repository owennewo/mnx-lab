import { LitElement, html, css, nothing } from 'lit';
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
import { formatPlaybackPosition, measureAt } from '../audio/playbackPosition.ts';
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
  @state() private volume = 0.7;
  private transport?: Transport;
  private sink?: NativeSink;
  private revision = 0;
  private playRequest = 0;
  private lastUpdate = '';
  private lastOrdinal: number | null = null;
  static styles = css`
    :host {
      display: block;
      font: 13px/1.4 system-ui;
      color: light-dark(#242424, #eeeeee);
      background: light-dark(#faf9f6, #252525);
      border-block: 1px solid light-dark(#ddd, #555);
    }
    .controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      padding: 10px;
    }
    button,
    select,
    input {
      font: inherit;
      accent-color: light-dark(#245daa, #8cbbff);
    }
    button,
    select {
      color: inherit;
      background: transparent;
      border: 1px solid light-dark(#aaa, #666);
      border-radius: 3px;
      padding: 5px 8px;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    button:focus-visible,
    select:focus-visible,
    input:focus-visible {
      outline: 2px solid light-dark(#245daa, #8cbbff);
      outline-offset: 2px;
    }
    output {
      flex: 1;
      min-width: 12em;
    }
    input {
      width: 75px;
    }
    label {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    details {
      padding: 0 10px 8px;
    }
    summary {
      cursor: pointer;
    }
    .table {
      max-height: 180px;
      overflow: auto;
      margin-top: 6px;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      font-variant-numeric: tabular-nums;
    }
    td,
    th {
      text-align: left;
      padding: 4px;
      border-bottom: 1px solid light-dark(#ddd, #444);
    }
    tr[aria-current='true'] {
      background: light-dark(#deebff, #304766);
    }
    td button {
      width: 100%;
      text-align: left;
      border: 0;
    }
    p {
      margin: 8px 10px;
    }
  `;
  connectedCallback() {
    super.connectedCallback();
    try {
      this.rate = Number(localStorage.getItem('mnx-player-rate')) || 1;
      this.volume = Number(localStorage.getItem('mnx-player-volume') ?? 0.7);
    } catch {}
    this.rate = Math.min(1.5, Math.max(0.5, this.rate));
    this.volume = Number.isFinite(this.volume) ? Math.min(1, Math.max(0, this.volume)) : 0.7;
    if (this.hasUpdated) this.install();
  }
  disconnectedCallback() {
    this.teardown();
    super.disconnectedCallback();
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
    } else if (changed.has('initialOrdinal') && this.initialOrdinal !== null)
      this.seek(this.initialOrdinal);
    if (!reinstall && changed.has('voicePreset') && this.sink) {
      const resume = this.status?.state === 'playing' || this.loading;
      this.pause();
      this.sink.setVoicePreset(this.sinkPreset(), this.requiredSamples());
      this.error = '';
      if (resume) void this.play();
    }
    if (changed.has('status')) {
      const row = this.renderRoot.querySelector<HTMLElement>('tr[aria-current=true]'),
        table = this.renderRoot.querySelector<HTMLElement>('.table');
      if (row && table) {
        const box = row.getBoundingClientRect(),
          frame = table.getBoundingClientRect();
        if (box.top < frame.top) table.scrollTop += box.top - frame.top;
        else if (box.bottom > frame.bottom) table.scrollTop += box.bottom - frame.bottom;
      }
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
  private changeRate(event: Event) {
    this.rate = Number((event.target as HTMLSelectElement).value);
    this.transport?.setRate(this.rate);
    try {
      localStorage.setItem('mnx-player-rate', String(this.rate));
    } catch {}
  }
  private changeVolume(event: Event) {
    this.volume = Number((event.target as HTMLInputElement).value);
    this.sink?.setVolume(this.volume);
    try {
      localStorage.setItem('mnx-player-volume', String(this.volume));
    } catch {}
  }
  render() {
    const playing = this.status?.state === 'playing';
    return html` <div class="controls">
        <button
          ?disabled=${!this.performance || this.loading}
          @click=${() => (playing ? this.pause() : void this.play())}
        >
          ${this.loading ? 'Loading…' : playing ? 'Pause' : 'Play'}</button
        ><button ?disabled=${!this.performance} @click=${() => this.stop()}>Stop</button>
        <output aria-live="off"
          >${this.performance
            ? formatPlaybackPosition(this.performance, this.position, this.document)
            : 'No performance available'}</output
        >
        <label
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
        <label
          >Rate<select aria-label="Playback rate" @change=${this.changeRate}>
            ${[0.5, 0.75, 1, 1.25, 1.5].map(
              (r) => html`<option value=${r} ?selected=${r === this.rate}>${r}×</option>`,
            )}
          </select></label
        >
        <label
          >Volume<input
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
      ${this.error ? html`<p role="alert">Playback unavailable: ${this.error}</p>` : nothing}
      ${this.performance
        ? html`<details open>
            <summary>Performed order · ${this.performance.measures.length} visits</summary>
            <div class="table">
              <table>
                <thead>
                  <tr>
                    <th>Visit</th>
                    <th>Written bar</th>
                    <th>Iteration</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.performance.measures.map(
                    (m) =>
                      html`<tr aria-current=${this.lastOrdinal === m.ordinal}>
                        <td>
                          <button
                            @click=${() => this.seek(m.ordinal)}
                            aria-label=${`Seek to visit ${m.ordinal + 1}`}
                          >
                            ${m.ordinal + 1}
                          </button>
                        </td>
                        <td>
                          ${this.document?.global.measures[m.measureIndex]?.number ??
                          m.measureIndex + 1}
                        </td>
                        <td>${m.iteration}</td>
                      </tr>`,
                  )}
                </tbody>
              </table>
            </div>
          </details>`
        : nothing}`;
  }
}
