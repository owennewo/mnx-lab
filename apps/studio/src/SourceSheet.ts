// The Source sheet on a piece: what plays. Synth first, then each recording with
// how it follows the score and a pencil to edit it, then Add recording. The
// playing recording opens its sync in place. From the Playback Sources design
// canvas, direction E (2026-09-14). It owns nothing: a choice, an edit and an
// add leave as events for the page, which drives the player and the editor.
import { LitElement, css, html, nothing, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { LibraryRecording } from '../../../src/storage/libraryClient.ts';
import type { MnxDocument } from '../../../src/model/mnx.ts';
import { linearizePasses } from '../../../src/model/passes.ts';
import { compilePerformance } from '../../../src/audio/performance.ts';
import { syncSummary, type SyncSummary } from './syncSummary.ts';

const line = (d: string, px: number) => svg`<svg width=${px} height=${px} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${d}></path></svg>`;

/** A source's mark: the waveform for the synth, a film strip for video, level bars for audio. */
export function sourceGlyph(kind: 'synth' | 'youtube' | 'audio', px = 18) {
  return kind === 'synth'
    ? line('M3 12h2l2-6 3 12 3-9 2 5 2-2h4', px)
    : kind === 'youtube'
      ? line('M4 5h16v14H4zM4 9h16M4 15h16M8 5v4M16 5v4M8 15v4M16 15v4', px)
      : line('M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2', px);
}
const cross = html`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>`;
const pencil = line('M4 20h4l10-10-4-4L4 16v4zM13 7l4 4', 14);
const plus = line('M12 5v14M5 12h14', 15);

@customElement('mnx-studio-source')
export class SourceSheet extends LitElement {
  /** The piece's playable recordings, as the library stores them. */
  @property({ attribute: false }) recordings: readonly LibraryRecording[] = [];
  @property({ attribute: false }) document: MnxDocument | null = null;
  /** `synth` or the id of the recording playing (or asked for). */
  @property() activeId = 'synth';
  /** The live score-follow warning for the active recording. */
  @property() syncWarning = '';
  @property({ type: Boolean }) canAdd = false;
  private compiled?: ReturnType<typeof compilePerformance>;
  private passes?: ReturnType<typeof linearizePasses>;

  static styles = css`
    :host { box-sizing: border-box; display: flex; flex-direction: column; width: 380px; max-width: 100%; height: 100%; border-left: 1px solid var(--line); background: light-dark(oklch(0.975 0.003 60), oklch(0.205 0.004 60)); color: var(--ink); overflow: auto; }
    header { display: flex; align-items: center; gap: 10px; padding: 14px 18px 10px; }
    header b { font-weight: 600; font-size: 15px; flex: 1; }
    button { font: inherit; color: inherit; background: transparent; border: 1px solid var(--line); border-radius: 3px; cursor: pointer; }
    button.plain { border: 0; padding: 4px; color: var(--ink-dim); display: inline-flex; }
    button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    section { padding: 4px 18px 14px; display: flex; flex-direction: column; gap: 8px; }
    .label { color: var(--ink-dim); font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .source { padding: 10px 0; border-bottom: 1px solid light-dark(oklch(0.9 0.003 60), oklch(0.27 0.004 60)); display: flex; flex-direction: column; gap: 8px; }
    .top { display: flex; align-items: center; gap: 8px; }
    .pick { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; min-height: 40px; padding: 0; border: 0; text-align: left; }
    .dot { display: grid; place-items: center; width: 18px; height: 18px; box-sizing: border-box; border-radius: 50%; border: 1.5px solid var(--ink-3); flex: none; }
    [aria-checked='true'] .dot { border-color: var(--accent); }
    [aria-checked='true'] .dot::after { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
    .text { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .text b { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sub { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-dim); }
    .sub svg { color: var(--ink-3); flex: none; }
    .sub.warn { color: light-dark(#a12121, #ffb4ab); }
    .square { display: grid; place-items: center; width: 36px; height: 36px; padding: 0; border-color: transparent; color: var(--ink-dim); flex: none; }
    .square:hover { border-color: var(--line); color: var(--ink); }
    .details { display: flex; flex-direction: column; gap: 8px; padding-left: 30px; font-size: 13px; }
    .stats { font: 500 12px/1.4 ui-monospace, 'SF Mono', Menlo, monospace; font-variant-numeric: tabular-nums; color: var(--ink-2, var(--ink)); }
    .diagnostic { font-size: 13px; padding: 10px; background: light-dark(#efeeeb, #343330); line-height: 1.5; }
    .small { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; height: 32px; padding: 0 10px; font-size: 13px; }
    .add { display: flex; align-items: center; gap: 10px; height: 40px; margin-top: 8px; padding: 0 12px; border: 1px dashed var(--line-strong); color: var(--ink-dim); font-size: 13px; }
    .add:hover { color: var(--ink); border-color: var(--ink-3); }
  `;

  protected willUpdate(changed: Map<PropertyKey, unknown>) {
    if (changed.has('document') && this.document) {
      this.passes = linearizePasses(this.document.mnxJson);
      this.compiled = compilePerformance(this.document.mnxJson, this.passes);
    }
  }

  private emit(type: string, detail?: unknown) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  /** The sub-line: what the recording is, and how it follows this score. */
  private follows(summary: SyncSummary, active: boolean) {
    if (summary.warning || (active && this.syncWarning)) return 'sync warning';
    if (!summary.points.length) return 'no sync points';
    return summary.coverage === 'full' ? 'follows the whole score' : 'follows part of the score';
  }

  private row(row: LibraryRecording) {
    const active = row.id === this.activeId;
    const summary = syncSummary(row, this.compiled, this.passes);
    const kind = row.kind === 'youtube' ? 'youtube' : 'audio';
    const name = row.name ?? 'Unnamed recording';
    const follows = this.follows(summary, active);
    const warning = active && (this.syncWarning || summary.warning || summary.dropped);
    const first = summary.points[0], last = summary.points.at(-1);
    return html`<div class="source">
      <div class="top">
        <button class="pick" type="button" role="radio" aria-checked=${active} data-source=${row.id} @click=${() => this.emit('source-choose', { id: row.id })}>
          <span class="dot"></span>
          <span class="text"><b>${name}</b><span class=${follows === 'sync warning' ? 'sub warn' : 'sub'}>${sourceGlyph(kind, 14)}${kind === 'youtube' ? 'Video' : 'Audio'} · ${follows}</span></span>
        </button>
        <button class="square" type="button" data-edit=${row.id} aria-label=${`Edit ${name}`} title="Edit details" @click=${() => this.emit('recording-edit', { id: row.id })}>${pencil}</button>
      </div>
      ${active
        ? html`<div class="details">
            ${first && last
              ? html`<span class="stats">${summary.points.length} sync ${summary.points.length === 1 ? 'point' : 'points'} · performed bars ${first.bar + 1}–${last.bar + 1}</span>`
              : nothing}
            ${warning
              ? html`<div class="diagnostic" role="status"><strong>Sync warning:</strong> ${this.syncWarning || (summary.warning ? summary.message : `${summary.dropped} out-of-range sync ${summary.dropped === 1 ? 'point' : 'points'} dropped.`)} Score following and seeking may be unavailable.</div>`
              : nothing}
            <button class="small" type="button" @click=${() => this.emit('recording-edit', { id: row.id })}>${pencil}<span>Edit details</span></button>
          </div>`
        : nothing}
    </div>`;
  }

  render() {
    const synth = this.activeId === 'synth';
    return html`
      <header><b>Source</b><button class="plain" type="button" aria-label="Close source" @click=${() => this.emit('close')}>${cross}</button></header>
      <section>
        <div class="label">Play from</div>
        <div role="radiogroup" aria-label="Play from">
          <div class="source">
            <div class="top">
              <button class="pick" type="button" role="radio" aria-checked=${synth} data-source="synth" @click=${() => this.emit('source-choose', { id: 'synth' })}>
                <span class="dot"></span>
                <span class="text"><b>Synth</b><span class="sub">${sourceGlyph('synth', 14)}Played from the score, part by part</span></span>
              </button>
            </div>
          </div>
          ${this.recordings.map((row) => this.row(row))}
        </div>
        ${this.canAdd ? html`<button class="add" type="button" aria-label="Add recording" @click=${() => this.emit('recording-add')}>${plus}<span>Add recording</span></button>` : nothing}
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mnx-studio-source': SourceSheet;
  }
}
